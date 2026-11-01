import { v7 as uuidv7, validate, version } from 'uuid';

export const newId = (): string => uuidv7();

/** Accepts any well-formed UUID; API path params use ParseUuidv7Pipe for the stricter check. */
export const isUuid = (value: string): boolean => validate(value);

export const isUuidv7 = (value: string): boolean => validate(value) && version(value) === 7;
