/* eslint-disable no-underscore-dangle, @typescript-eslint/no-explicit-any */
import { z } from 'zod';

type ParsedData<T> = { error?: string; data?: T };

function parseNumber(str: string): ParsedData<number> {
  const num = +str;
  return Number.isNaN(num) ? { error: `${str} is NaN` } : { data: num };
}

function getInnerType(schema: z.ZodTypeAny) {
  switch (schema.constructor) {
    case z.ZodOptional:
    case z.ZodDefault:
      return schema._def.innerType;
    default:
      return schema;
  }
}

function parseBoolean(str: string): ParsedData<boolean> {
  switch (str) {
    case 'true':
      return { data: true };
    case 'false':
      return { data: false };
    default:
      return { error: `${str} is not a boolean` };
  }
}

function parseArray<T>(
  values: string[],
  parseFunction: (str: string) => ParsedData<T>,
): ParsedData<T[]> {
  const numbers = values.map(parseFunction);
  const error = numbers.find((n) => n.error)?.error;
  if (error) return { error };
  return { data: numbers.map((n) => n.data!) };
}

function parseValues(schema: any, values: string[]): ParsedData<any> {
  switch (schema.constructor) {
    case z.ZodNumber:
      return parseNumber(values[0]);
    case z.ZodBoolean:
      return parseBoolean(values[0]);
    case z.ZodString:
      return { data: values[0] };
    case z.ZodArray: {
      // eslint-disable-next-line no-underscore-dangle
      const elementSchema = schema._def.type;
      switch (elementSchema.constructor) {
        case z.ZodNumber:
          return parseArray(values, parseNumber);
        case z.ZodBoolean:
          return parseArray(values, parseBoolean);
        case z.ZodString:
          return { data: values };
        default:
          return {
            error: `unsupported array element type ${String(
              elementSchema.constructor,
            )}`,
          };
      }
    }
    default:
      return { error: `unsupported type ${String(schema.constructor)}` };
  }
}

function getRequireds(shape: z.ZodRawShape) {
  const keys: string[] = [];
  for (const key in shape) {
    if (Object.prototype.hasOwnProperty.call(shape, key)) {
      const fieldShape = shape[key];
      if (
        !(fieldShape instanceof z.ZodDefault) &&
        !(fieldShape instanceof z.ZodOptional)
      )
        keys.push(key);
    }
  }
  return keys;
}

function convertToRequiredType(
  values: string[],
  schema: z.ZodTypeAny,
): ParsedData<any> {
  const usedSchema = getInnerType(schema);
  if (values.length > 1 && !(usedSchema instanceof z.ZodArray))
    return { error: 'Multiple values for non-array field' };
  const value = parseValues(usedSchema, values);
  if (value.error && schema.constructor === z.ZodDefault) {
    return { data: undefined };
  }
  return value;
}

function parseShape(
  shape: z.ZodRawShape,
  paramsArray: Record<string, string[]>,
  isPartOfUnion = false,
): Record<string, any> {
  const parsed: Record<string, any> = {};

  for (const key in shape) {
    if (Object.prototype.hasOwnProperty.call(shape, key)) {
      const fieldSchema: z.ZodTypeAny = shape[key];
      if (paramsArray[key]) {
        const fieldData = convertToRequiredType(paramsArray[key], fieldSchema);

        if (fieldData.error) {
          if (isPartOfUnion) return {};
          return parsed;
        }
        const result = fieldSchema.safeParse(fieldData.data!);
        if (result.success) parsed[key] = result.data;
      } else if (fieldSchema instanceof z.ZodDefault) {
        const result = fieldSchema.safeParse(undefined);
        if (result.success) parsed[key] = result.data;
      }
    }
  }

  return parsed;
}

function processSchema(
  schema: z.ZodTypeAny,
  paramsArray: Record<string, string[]>,
): Record<string, any> {
  let processedSchema = schema;
  if (schema instanceof z.ZodOptional) {
    processedSchema = schema._def.innerType;
  }
  switch (processedSchema.constructor) {
    case z.ZodObject: {
      const { shape } = processedSchema as z.ZodObject<z.ZodRawShape>;
      return parseShape(shape, paramsArray);
    }
    case z.ZodUnion: {
      const { options } = (
        processedSchema as z.ZodUnion<
          [z.ZodObject<z.ZodRawShape>, ...z.ZodObject<z.ZodRawShape>[]]
        >
      )._def;
      for (const option of options) {
        const { shape } = option;
        const requireds = getRequireds(shape);

        const result = parseShape(shape, paramsArray, true);
        const keys = Object.keys(result);

        if (requireds.every((key) => keys.includes(key))) {
          return result;
        }
      }
      return {};
    }
    default:
      throw new Error('Unsupported schema type');
  }
}

function getAllParamsAsArrays(
  searchParams: URLSearchParams,
): Record<string, string[]> {
  const params: Record<string, string[]> = {};

  searchParams.forEach((value, key) => {
    if (!params[key]) {
      params[key] = [];
    }
    params[key].push(value);
  });

  return params;
}

export function safeParseSearchParams<T extends z.ZodTypeAny>(
  schema: T,
  searchParams: URLSearchParams,
): z.infer<T> {
  const paramsArray = getAllParamsAsArrays(searchParams);
  return processSchema(schema, paramsArray);
}
