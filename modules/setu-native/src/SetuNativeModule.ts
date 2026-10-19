import { requireNativeModule } from 'expo';
import type { SetuNativeModule } from './SetuNative.types';

const native = requireNativeModule<SetuNativeModule>('SetuNative');
const androidOnly = (): never => {
  throw new Error('ANDROID_BACKGROUND_SERVICE_UNAVAILABLE');
};

export default new Proxy(native, {
  get(target, property) {
    if (
      property === 'startSetuService' ||
      property === 'stopSetuService' ||
      property === 'isSetuServiceRunning' ||
      property === 'getStartOnBoot' ||
      property === 'setStartOnBoot' ||
      property === 'isIgnoringBatteryOptimizations' ||
      property === 'openBatteryOptimizationSettings'
    )
      return androidOnly;
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
