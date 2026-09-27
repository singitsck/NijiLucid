import { getRequiredDeviceLimits } from './gpu-device-limits';

/**
 * Keep adapter selection identical between playback and the onboarding benchmark.
 * On Apple silicon WebGPU is backed by Metal; asking for the high-performance
 * adapter avoids an avoidable low-power choice on platforms that expose one.
 */
export function createPreferredAdapterOptions(platform = navigator.platform): GPURequestAdapterOptions {
  return platform.startsWith('Win')
    ? {}
    : { powerPreference: 'high-performance' };
}

/**
 * Request only optional features that the renderer currently consumes. Merely
 * enabling shader-f16 or subgroups does not accelerate f32 WGSL, and requesting
 * unused features makes device creation less portable.
 */
export function createRuntimeDeviceDescriptor(adapter: GPUAdapter): GPUDeviceDescriptor {
  const optionalFeatures: GPUFeatureName[] = [];
  if (adapter.features.has('timestamp-query')) optionalFeatures.push('timestamp-query');
  // Request f16 up front so certified, capability-gated shader variants can be
  // compiled without replacing the shared device. Existing f32 shaders are
  // unaffected merely by enabling the feature.
  if (adapter.features.has('shader-f16')) optionalFeatures.push('shader-f16');

  return {
    ...(optionalFeatures.length > 0 ? { requiredFeatures: optionalFeatures } : {}),
    requiredLimits: getRequiredDeviceLimits(adapter),
  };
}
