// Все числа XP в одном месте, чтобы балансить без поиска по коду.
export const XP = {
  /** Верный ответ в уроке с ПЕРВОЙ попытки (повторные попытки XP не дают — защита от подбора). */
  LESSON_ANSWER_FIRST_TRY: 10,
  /** Пройден таб урока (math или grammar). */
  LESSON_COMPLETED: 20,
  /** Пройден уровень пути целиком. */
  LEVEL_COMPLETED: 30,
  /** Верный ответ в повторении (первые REVIEW_FULL_XP_SESSIONS сессий за день). */
  REVIEW_ANSWER: 5,
  /** Верный ответ в повторении после лимита сессий — защита от фарма. */
  REVIEW_ANSWER_CAPPED: 1,
  REVIEW_FULL_XP_SESSIONS: 2,
  /** Полная цель дня. */
  DAILY_GOAL_BONUS: 50,
} as const;
