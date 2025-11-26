/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { BaseEntity, isBaseEntity, UUID, createUUID } from './types';

describe('isBaseEntity', () => {
  it('should return true for a valid BaseEntity object', () => {
    const entity: BaseEntity = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(isBaseEntity(entity)).toBe(true);
  });

  it('should return false for an object missing id', () => {
    const obj = {
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(isBaseEntity(obj)).toBe(false);
  });

  it('should return false for an object missing createdAt', () => {
    const obj = {
      id: 'some-id',
      updatedAt: new Date(),
    };
    expect(isBaseEntity(obj)).toBe(false);
  });

  it('should return false for an object missing updatedAt', () => {
    const obj = {
      id: 'some-id',
      createdAt: new Date(),
    };
    expect(isBaseEntity(obj)).toBe(false);
  });

  it('should return false for an object with incorrect id type', () => {
    const obj = {
      id: 123, // Should be string
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(isBaseEntity(obj)).toBe(false);
  });

  it('should return false for an object with incorrect createdAt type', () => {
    const obj = {
      id: 'some-id',
      createdAt: 'not-a-date', // Should be Date
      updatedAt: new Date(),
    };
    expect(isBaseEntity(obj)).toBe(false);
  });

  it('should return false for an object with incorrect updatedAt type', () => {
    const obj = {
      id: 'some-id',
      createdAt: new Date(),
      updatedAt: 'not-a-date', // Should be Date
    };
    expect(isBaseEntity(obj)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isBaseEntity(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isBaseEntity(undefined)).toBe(false);
  });

  it('should return false for a number', () => {
    expect(isBaseEntity(123)).toBe(false);
  });

  it('should return false for a string', () => {
    expect(isBaseEntity('hello')).toBe(false);
  });

  it('should return false for an empty object', () => {
    expect(isBaseEntity({})).toBe(false);
  });

  it('should return false for an object with extra properties but missing core ones', () => {
    const obj = {
      extra: 'property',
      id: 'some-id',
      createdAt: new Date(),
    };
    expect(isBaseEntity(obj)).toBe(false); // Missing updatedAt
  });

  it('should return true for an object with extra properties and all core ones', () => {
    const obj = {
      id: 'some-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      extraField: 'value',
    };
    expect(isBaseEntity(obj)).toBe(true);
  });
});

describe('createUUID', () => {
  it('should return the input string as a branded UUID', () => {
    const uuidString = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
    const brandedUuid: UUID = createUUID(uuidString);
    expect(brandedUuid).toBe(uuidString);

    // This is a compile-time check for branding, but we can verify it at runtime as a string
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const testAssignment: string = brandedUuid; // A UUID can be assigned to a string
    // const testInvalidAssignment: UUID = 'not-a-branded-uuid'; // This would be a TS error, not a runtime test
    expect(typeof brandedUuid).toBe('string');
  });

  it('should handle an empty string as a UUID (branding only, no validation)', () => {
    const brandedUuid: UUID = createUUID('');
    expect(brandedUuid).toBe('');
  });

  it('should handle a non-UUID string (branding only, no validation)', () => {
    const nonUuidString = 'not-a-real-uuid';
    const brandedUuid: UUID = createUUID(nonUuidString);
    expect(brandedUuid).toBe(nonUuidString);
  });
});