/**
 * RuVector Quantization — scalar (Int8)
 *
 * ScalarQuantizer: 4x memory reduction via int8 calibration.
 * Extracted verbatim from quantization.ts (lines 272-458) during the
 * P3.43 god-file decomposition (W164). quantization.ts stays the barrel.
 */

import type {
  IQuantizer,
  QuantizationType,
  ScalarQuantizationOptions,
} from './quantization-types.js';
import type { CalibrationData } from './quantization-internal.js';

// ============================================================================
// Scalar Quantization
// ============================================================================

/**
 * ScalarQuantizer implements per-dimension scalar quantization.
 *
 * Quantizes float32 vectors to int8 for 4x memory reduction.
 * Supports symmetric and asymmetric quantization schemes.
 *
 * @example
 * ```typescript
 * const quantizer = new ScalarQuantizer({ dimensions: 128 });
 * quantizer.calibrate(trainingVectors);
 * const quantized = quantizer.quantize(vectors);
 * const reconstructed = quantizer.dequantize(quantized);
 * ```
 */
export class ScalarQuantizer implements IQuantizer {
  readonly type: QuantizationType = 'scalar';
  readonly dimensions: number;

  private calibration: CalibrationData;
  private readonly symmetric: boolean;
  private readonly bits: number;
  private readonly qmin: number;
  private readonly qmax: number;
  private isCalibrated: boolean = false;

  constructor(options: ScalarQuantizationOptions) {
    this.dimensions = options.dimensions;
    this.symmetric = options.symmetric ?? false;
    this.bits = options.bits ?? 8;

    // Compute quantization range based on bits
    this.qmin = -(1 << (this.bits - 1));
    this.qmax = (1 << (this.bits - 1)) - 1;

    // Initialize with default calibration
    this.calibration = {
      minValue: options.minValue ?? -1,
      maxValue: options.maxValue ?? 1,
      scale: 1,
      zeroPoint: 0,
    };

    if (options.minValue !== undefined && options.maxValue !== undefined) {
      this.computeCalibration(options.minValue, options.maxValue);
      this.isCalibrated = true;
    }
  }

  /**
   * Calibrates the quantizer using sample vectors.
   *
   * @param samples - Representative vectors for calibration
   */
  calibrate(samples: number[][]): void {
    if (samples.length === 0) {
      throw new Error('Cannot calibrate with empty samples');
    }

    // Find min and max across all dimensions and samples
    let minValue = Infinity;
    let maxValue = -Infinity;

    for (const sample of samples) {
      for (let i = 0; i < sample.length; i++) {
        minValue = Math.min(minValue, sample[i]);
        maxValue = Math.max(maxValue, sample[i]);
      }
    }

    // Add small margin for numerical stability
    const range = maxValue - minValue;
    minValue -= range * 0.01;
    maxValue += range * 0.01;

    this.computeCalibration(minValue, maxValue);
    this.isCalibrated = true;
  }

  private computeCalibration(minValue: number, maxValue: number): void {
    if (this.symmetric) {
      // Symmetric quantization: use same scale for positive and negative
      const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue));
      this.calibration = {
        minValue: -absMax,
        maxValue: absMax,
        scale: (2 * absMax) / (this.qmax - this.qmin),
        zeroPoint: 0,
      };
    } else {
      // Asymmetric quantization: full range utilization
      this.calibration = {
        minValue,
        maxValue,
        scale: (maxValue - minValue) / (this.qmax - this.qmin),
        zeroPoint: Math.round(this.qmin - minValue / ((maxValue - minValue) / (this.qmax - this.qmin))),
      };
    }
  }

  /**
   * Quantizes float32 vectors to int8.
   *
   * @param vectors - Input vectors
   * @returns Quantized int8 arrays
   */
  quantize(vectors: number[][]): Int8Array[] {
    if (!this.isCalibrated) {
      // Auto-calibrate if not done
      this.calibrate(vectors);
    }

    const { scale, zeroPoint } = this.calibration;

    return vectors.map((vec) => {
      const quantized = new Int8Array(vec.length);
      for (let i = 0; i < vec.length; i++) {
        const q = Math.round(vec[i] / scale) + zeroPoint;
        quantized[i] = Math.max(this.qmin, Math.min(this.qmax, q));
      }
      return quantized;
    });
  }

  /**
   * Dequantizes int8 arrays back to float32 vectors.
   *
   * @param quantized - Quantized int8 arrays
   * @returns Reconstructed float vectors (lossy)
   */
  dequantize(quantized: Int8Array[]): number[][] {
    const { scale, zeroPoint } = this.calibration;

    return quantized.map((q) => {
      const vec = new Array(q.length);
      for (let i = 0; i < q.length; i++) {
        vec[i] = (q[i] - zeroPoint) * scale;
      }
      return vec;
    });
  }

  /**
   * Computes approximate distance using quantized vectors.
   *
   * @param a - First quantized vector
   * @param b - Second quantized vector
   * @returns Approximate Euclidean distance
   */
  quantizedDistance(a: Int8Array, b: Int8Array): number {
    const { scale } = this.calibration;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum) * scale;
  }

  getCompressionRatio(): number {
    // float32 (4 bytes) -> int8 (1 byte) = 4x
    return 4;
  }

  getMemoryReduction(): string {
    return '4x';
  }

  /**
   * Gets the current calibration data.
   */
  getCalibration(): CalibrationData {
    return { ...this.calibration };
  }

  /**
   * Sets calibration data directly.
   */
  setCalibration(calibration: CalibrationData): void {
    this.calibration = { ...calibration };
    this.isCalibrated = true;
  }
}

