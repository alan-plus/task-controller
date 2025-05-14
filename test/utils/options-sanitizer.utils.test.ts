import { OptionsSanitizerUtils } from "../../src/utils/options-sanitizer.utils";

test("sanitizeToRequired: undefined options", async () => {
  type OptionType = {field1?: string}; 
  const options: OptionType | undefined = undefined;
  const defaultOptions = {field1: "stringField"} as Required<OptionType>;
  
  const sanitizedOptions = OptionsSanitizerUtils.sanitizeToRequired<OptionType>(options, defaultOptions);
  
  expect(sanitizedOptions.field1).toBe("stringField");
});

test("sanitizeToRequired: different type field", async () => {
  type OptionType = {field1?: string}; 
  const options: OptionType = {field1: []} as unknown as OptionType;
  const defaultOptions = {field1: "stringField"} as Required<OptionType>;
  
  const sanitizedOptions = OptionsSanitizerUtils.sanitizeToRequired<OptionType>(options, defaultOptions);
  
  expect(sanitizedOptions.field1).toBe("stringField");
});

test("sanitizeToRequired: respect functions", async () => {
  const aFunction = () => {};

  type OptionType = {aFunction?: () => {}}; 
  const options: OptionType = {aFunction} as OptionType;
  const defaultOptions = {aFunction: () => {}} as Required<OptionType>;
  
  const sanitizedOptions = OptionsSanitizerUtils.sanitizeToRequired<OptionType>(options, defaultOptions);
  
  expect(sanitizedOptions.aFunction).toBe(aFunction);
});

test("sanitizeToRequired: respect abort", async () => {
    const abortController = new AbortController();

  type OptionType = {signal: AbortSignal}; 
  const options: OptionType = {signal: abortController.signal} as OptionType;
  const defaultOptions = {signal: { aborted: false } as AbortSignal} as Required<OptionType>;
  
  const sanitizedOptions = OptionsSanitizerUtils.sanitizeToRequired<OptionType>(options, defaultOptions);

  expect(sanitizedOptions.signal).toBe(abortController.signal);
  abortController.abort();
  expect(sanitizedOptions.signal.aborted).toBe(true);
});

test("sanitize: undefined options", async () => {
  type OptionType = {field1?: number}; 
  const options: OptionType | undefined = undefined;
  const defaultOptions = {field1: 100} as Required<OptionType>;
  
  const sanitizedOptions = OptionsSanitizerUtils.sanitize<OptionType>(options, defaultOptions);
  
  expect(sanitizedOptions).toBe(undefined);
});

test("sanitize: different type field", async () => {
  type OptionType = {field1?: number}; 
  const options: OptionType = {field1: "stringField"} as unknown as OptionType;
  const defaultOptions = {field1: 100} as Required<OptionType>;
  
  const sanitizedOptions = OptionsSanitizerUtils.sanitize<OptionType>(options, defaultOptions);
  
  if(sanitizedOptions !== undefined){
    expect(sanitizedOptions.field1).toBe(undefined);
  }else{
    fail("sanitizedOptions missed");
  }
});

test("sanitizeNumberToPositiveGraterThanZeroInteger: undefined number without default", async () => {
  const sanitizedNumber = OptionsSanitizerUtils.sanitizeNumberToPositiveGraterThanZeroInteger(undefined);
  
  expect(sanitizedNumber).toBe(undefined);
});

test("sanitizeNumberToPositiveGraterThanZeroInteger: undefined number with default", async () => {
  const defaultValue = 100;

  const sanitizedNumber = OptionsSanitizerUtils.sanitizeNumberToPositiveGraterThanZeroInteger(undefined, defaultValue);
  
  expect(sanitizedNumber).toBe(defaultValue);
});

test("sanitizeNumberToPositiveGraterThanZeroInteger: not number type with default", async () => {
  const defaultValue = 100;

  const sanitizedNumber = OptionsSanitizerUtils.sanitizeNumberToPositiveGraterThanZeroInteger("stringValue" as unknown as number, defaultValue);
  
  expect(sanitizedNumber).toBe(defaultValue);
});

test("sanitizeNumberToPositiveGraterThanZeroInteger: NaN with default", async () => {
  const defaultValue = 100;

  const sanitizedNumber = OptionsSanitizerUtils.sanitizeNumberToPositiveGraterThanZeroInteger(NaN as unknown as number, defaultValue);
  
  expect(sanitizedNumber).toBe(defaultValue);
});

test("sanitizeNumberToPositiveGraterThanZeroInteger: infinity with default", async () => {
  const defaultValue = 100;

  const sanitizedNumber = OptionsSanitizerUtils.sanitizeNumberToPositiveGraterThanZeroInteger(Infinity as unknown as number, defaultValue);
  
  expect(sanitizedNumber).toBe(defaultValue);
});

test("sanitizeNumberToPositiveGraterThanZeroInteger: decimal without default", async () => {
  const sanitizedNumber = OptionsSanitizerUtils.sanitizeNumberToPositiveGraterThanZeroInteger(100.1);
  expect(sanitizedNumber).toBe(100);
});

test("sanitizeNumberToPositiveGraterThanZeroInteger: decimal without default", async () => {
  const sanitizedNumber = OptionsSanitizerUtils.sanitizeNumberToPositiveGraterThanZeroInteger(99.9);
  expect(sanitizedNumber).toBe(100);
});

test("sanitizeNumberToPositiveGraterThanZeroInteger: decimal without default", async () => {
  const sanitizedNumber = OptionsSanitizerUtils.sanitizeNumberToPositiveGraterThanZeroInteger(99.5);
  expect(sanitizedNumber).toBe(100);
});

test("sanitizeNumberToPositiveGraterThanZeroInteger: negative with default", async () => {
    const defaultValue = 100;

  const sanitizedNumber = OptionsSanitizerUtils.sanitizeNumberToPositiveGraterThanZeroInteger(-50, defaultValue);
  
  expect(sanitizedNumber).toBe(100);
});
