import { Injectable, NotFoundException } from '@nestjs/common';
import { DailyProgress, StudyIntensity, User } from '@prisma/client';
import { PrismaService } from '@common/database/prisma.service';
import { DEFAULT_TIMEZONE, daysBetween, isValidTimezone, localDate } from '@common/utils/local-date';
import { ReviewPoolService } from './review-pool.service';
import { XP } from './xp.rules';

/** Цель дня по интенсивности из онбординга. */
export const DAILY_GOAL: Record<StudyIntensity, { lessons: number; review: number }> = {
  LIGHT: { lessons: 1, review: 0 },
  NORMAL: { lessons: 1, review: 10 },
  INTENSE: { lessons: 2, review: 10 },
};

/** Минимум, который продлевает серию: 1 урок ИЛИ столько повторений. */
export const STREAK_MIN_LESSONS = 1;
export const STREAK_MIN_REVIEW = 10;

export interface DailyEvents {
  /** Минимум дня выполнен только что -> серия продлена. */
  streakExtended: boolean;
  /** Полная цель дня выполнена только что -> бонус XP. */
  goalCompleted: boolean;
  bonusXp: number;
}

type Ctx = { user: User; today: Date; day: DailyProgress };

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewPool: ReviewPoolService,
  ) {}

  // ---------------------------------------------------------------- core

  private async loadUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  private async targetsFor(userId: string, intensity: StudyIntensity) {
    const goal = DAILY_GOAL[intensity];
    // Нечего повторять (первый день) -> засчитывается только урок.
    const review = goal.review === 0 ? 0 : Math.min(goal.review, await this.reviewPool.getPoolSize(userId));
    return { lessonTarget: goal.lessons, reviewTarget: review };
  }

  /**
   * Сегодняшняя строка daily_progress по локальной дате пользователя.
   * Заодно сбрасывает серию, если был пропущен день. Цели фиксируются при создании строки
   * (иначе первый пройденный урок сразу увеличивал бы цель повторений того же дня).
   */
  private async context(userId: string): Promise<Ctx> {
    let user = await this.loadUser(userId);
    const today = localDate(user.timezone);

    if (user.currentStreak > 0 && (!user.lastStreakDate || daysBetween(user.lastStreakDate, today) > 1)) {
      user = await this.prisma.user.update({ where: { id: userId }, data: { currentStreak: 0 } });
    }

    let day = await this.prisma.dailyProgress.findUnique({ where: { userId_date: { userId, date: today } } });
    if (!day) {
      const targets = await this.targetsFor(userId, user.studyIntensity);
      try {
        day = await this.prisma.dailyProgress.create({ data: { userId, date: today, ...targets } });
      } catch (error) {
        // Два запроса одновременно создали день — читаем победителя.
        if ((error as { code?: string }).code !== 'P2002') throw error;
        day = await this.prisma.dailyProgress.findUniqueOrThrow({ where: { userId_date: { userId, date: today } } });
      }
    }
    return { user, today, day };
  }

  /** Проверяет минимум/цель и один раз начисляет серию/бонус. updateMany с условием — защита от двойного начисления. */
  private async evaluate({ user, today, day }: Ctx): Promise<DailyEvents> {
    const events: DailyEvents = { streakExtended: false, goalCompleted: false, bonusXp: 0 };
    const minimum = day.lessonsCompleted >= STREAK_MIN_LESSONS || day.reviewAnswered >= STREAK_MIN_REVIEW;
    const goal = day.lessonsCompleted >= day.lessonTarget && day.reviewAnswered >= day.reviewTarget;

    if (minimum && !day.minimumMet) {
      const { count } = await this.prisma.dailyProgress.updateMany({ where: { id: day.id, minimumMet: false }, data: { minimumMet: true } });
      if (count > 0) {
        const gap = user.lastStreakDate ? daysBetween(user.lastStreakDate, today) : null;
        const current = gap === 0 ? user.currentStreak : gap === 1 ? user.currentStreak + 1 : 1;
        await this.prisma.user.update({
          where: { id: user.id },
          data: { currentStreak: current, longestStreak: Math.max(user.longestStreak, current), lastStreakDate: today },
        });
        events.streakExtended = true;
      }
    }

    if (goal && !day.goalMet) {
      const { count } = await this.prisma.dailyProgress.updateMany({ where: { id: day.id, goalMet: false }, data: { goalMet: true } });
      if (count > 0) {
        events.goalCompleted = true;
        events.bonusXp = await this.addXp(user.id, XP.DAILY_GOAL_BONUS);
      }
    }
    return events;
  }

  // ---------------------------------------------------------------- public API

  /** +XP к пользователю и к сегодняшнему дню. */
  async addXp(userId: string, amount: number): Promise<number> {
    if (amount <= 0) return 0;
    const { today } = await this.context(userId);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { xp: { increment: amount } } }),
      this.prisma.dailyProgress.update({ where: { userId_date: { userId, date: today } }, data: { xpEarned: { increment: amount } } }),
    ]);
    return amount;
  }

  /** Пройден урок (таб) в Study. */
  async recordLessonCompleted(userId: string): Promise<DailyEvents> {
    const ctx = await this.context(userId);
    const day = await this.prisma.dailyProgress.update({ where: { id: ctx.day.id }, data: { lessonsCompleted: { increment: 1 } } });
    return this.evaluate({ ...ctx, day });
  }

  /** Новая сессия повторения (влияет на лимит XP за повторение). */
  async startReviewSession(userId: string): Promise<number> {
    const ctx = await this.context(userId);
    const day = await this.prisma.dailyProgress.update({ where: { id: ctx.day.id }, data: { reviewSessions: { increment: 1 } } });
    return day.reviewSessions;
  }

  /** Ответ в повторении: засчитывается в цель дня, XP с лимитом по сессиям. */
  async recordReviewAnswer(userId: string, correct: boolean): Promise<{ xpGained: number; events: DailyEvents }> {
    const ctx = await this.context(userId);
    const day = await this.prisma.dailyProgress.update({ where: { id: ctx.day.id }, data: { reviewAnswered: { increment: 1 } } });
    const fullXp = day.reviewSessions <= XP.REVIEW_FULL_XP_SESSIONS;
    const xpGained = correct ? await this.addXp(userId, fullXp ? XP.REVIEW_ANSWER : XP.REVIEW_ANSWER_CAPPED) : 0;
    const events = await this.evaluate({ ...ctx, day });
    return { xpGained, events };
  }

  /** После смены интенсивности в профиле — пересчитать цель сегодняшнего дня (если ещё не выполнена). */
  async applyIntensityChange(userId: string): Promise<void> {
    const ctx = await this.context(userId);
    if (ctx.day.goalMet) return;
    const targets = await this.targetsFor(userId, ctx.user.studyIntensity);
    const day = await this.prisma.dailyProgress.update({ where: { id: ctx.day.id }, data: targets });
    await this.evaluate({ ...ctx, day });
  }

  /** Часовой пояс с телефона (заголовок X-Timezone). Невалидный игнорируется. */
  async syncTimezone(userId: string, timezone: string | undefined) {
    if (!isValidTimezone(timezone)) return;
    await this.prisma.user.updateMany({ where: { id: userId, NOT: { timezone } }, data: { timezone } });
  }

  /** Данные для Главной: серия, XP, цель дня. */
  async getToday(userId: string) {
    const { user, day } = await this.context(userId);
    const tz = isValidTimezone(user.timezone) ? user.timezone : DEFAULT_TIMEZONE;
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === 'hour')!.value);
    const minute = Number(parts.find((p) => p.type === 'minute')!.value);
    const hoursLeftToday = Math.max(0, Math.round((24 - hour - minute / 60) * 10) / 10);

    return {
      date: day.date.toISOString().slice(0, 10),
      timezone: tz,
      studyIntensity: user.studyIntensity,
      xp: user.xp,
      xpToday: day.xpEarned,
      streak: {
        current: user.currentStreak,
        longest: user.longestStreak,
        extendedToday: day.minimumMet,
        // "Серия сгорит через N часов" — для вечернего напоминания
        atRisk: user.currentStreak > 0 && !day.minimumMet,
        hoursLeftToday,
      },
      goal: {
        lessons: { done: day.lessonsCompleted, target: day.lessonTarget },
        review: { done: day.reviewAnswered, target: day.reviewTarget },
        minimum: { lessons: STREAK_MIN_LESSONS, review: STREAK_MIN_REVIEW },
        minimumMet: day.minimumMet,
        goalMet: day.goalMet,
      },
      reviewSessionsToday: day.reviewSessions,
      hasSubscription: user.hasSubscription,
    };
  }
}
