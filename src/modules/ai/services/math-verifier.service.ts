import { Injectable } from '@nestjs/common';
import { evaluate } from 'mathjs';

@Injectable()
export class MathVerifierService {
  verifyNumeric(expression: string, claimedResult: number, tolerance = 1e-6): boolean {
    try { return Math.abs(evaluate(expression) - claimedResult) < tolerance; } catch { return false; }
  }
}
