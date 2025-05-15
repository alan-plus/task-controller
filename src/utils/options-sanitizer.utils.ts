export class OptionsSanitizerUtils {

  public static sanitizeToRequired<T extends object>(options: T | undefined, defaults: Required<T>): Required<T>{
        if (options === null || options === undefined || Array.isArray(options) || typeof options !== "object") {
      return defaults;
    }

    const sanitizedOptions: T = { ...defaults };

    for (const key in defaults) {
      const typedKey = key as keyof T;

      const defaultValue = defaults[typedKey];
      const value = options[typedKey] as any;
      if (value === null || value === undefined) {
        continue;
      }

      const defaultValueType = typeof defaultValue;
      const valueType = typeof value;
      if (defaultValueType !== valueType) {
        continue;
      }

      sanitizedOptions[typedKey] = value;
    }

    return sanitizedOptions as Required<T>;
  }

    public static sanitize<T extends object>(options: T | undefined, defaults: Required<T>): Partial<T> | undefined{
    if (options === null || options === undefined || Array.isArray(options) || typeof options !== "object") {
      return undefined;
    }

    const sanitizedOptions: Partial<T> = {};

    for (const key in defaults) {
      const typedKey = key as keyof T;

      const defaultValue = defaults[typedKey];
      const value = options[typedKey] as any;
      if (value === null || value === undefined) {
        continue;
      }

      const defaultValueType = typeof defaultValue;
      const valueType = typeof value;
      if (defaultValueType !== valueType) {
        continue;
      }

      sanitizedOptions[typedKey] = value;
    }

    return sanitizedOptions;
  }

  public static sanitizeNumberToPositiveGraterThanZeroInteger(value: number | undefined, defaultValue?: number): number | undefined {
    if(value === null || value === undefined){
      return defaultValue;
    }

    if(typeof value !== "number"){
      return defaultValue;
    }

    if (Number.isNaN(value)) {
      return defaultValue;
    } 

    if (!Number.isFinite(value)) {
      return defaultValue;
    } 

    if (!Number.isInteger(value)) {
      return Math.round(value);
    }

    if(value <= 0){
      return defaultValue;
    }
    
    return value;
  }
  
}