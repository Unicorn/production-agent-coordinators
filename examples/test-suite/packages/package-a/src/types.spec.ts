/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import type {
  PackageResult,
  Identifiable,
  Primitive,
  KeyOf,
  DeepPartial,
  Branded
} from './index.js'; // Import types from index.js

// Helper for type assertions (runtime checks can only verify shape, not type strictness)
// For true compile-time type testing, tools like 'tsd' are used, but for Jest,
// we often rely on simply ensuring compilation succeeds with these types in test files
// and doing runtime checks on the data structures.
function assertType<T>(_: T): void {
  // This function does nothing at runtime, it's purely for compile-time type checking.
  // If `value` does not conform to `T`, TypeScript will report an error.
}

describe('Type Definitions', () => {
  describe('PackageResult', () => {
    it('should correctly type successful results', () => {
      const successResult: PackageResult<string> = { success: true, data: 'Success!' };
      assertType<PackageResult<string>>(successResult);
      expect(successResult.success).toBe(true);
      expect(successResult.data).toBe('Success!');
      // @ts-expect-error - data should not be number if T is string
      // const badSuccessResult: PackageResult<string> = { success: true, data: 123 };
    });

    it('should correctly type error results', () => {
      const errorResult: PackageResult = { success: false, error: 'Something went wrong.' };
      assertType<PackageResult<number>>(errorResult); // T can be anything for error result
      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toBe('Something went wrong.');
      expect(errorResult.data).toBeUndefined();
    });

    it('should allow optional data and error properties', () => {
      const bareSuccess: PackageResult = { success: true };
      const bareError: PackageResult = { success: false };
      assertType<PackageResult>(bareSuccess);
      assertType<PackageResult>(bareError);
      expect(bareSuccess.success).toBe(true);
      expect(bareSuccess.data).toBeUndefined();
      expect(bareSuccess.error).toBeUndefined();
      expect(bareError.success).toBe(false);
    });
  });

  describe('Identifiable', () => {
    interface MyObject extends Identifiable {
      name: string;
    }

    it('should ensure objects have an id property', () => {
      const obj: MyObject = { id: 'abc-123', name: 'Test' };
      assertType<Identifiable>(obj);
      expect(obj.id).toBe('abc-123');
      expect(obj.name).toBe('Test');
      // @ts-expect-error - missing id
      // const badObj: MyObject = { name: 'Test' };
    });
  });

  describe('Primitive', () => {
    it('should correctly type primitive values', () => {
      const s: Primitive = 'hello';
      const n: Primitive = 123;
      const b: Primitive = true;
      const sy: Primitive = Symbol('test');
      const nu: Primitive = null;
      const u: Primitive = undefined;

      assertType<Primitive>(s);
      assertType<Primitive>(n);
      assertType<Primitive>(b);
      assertType<Primitive>(sy);
      assertType<Primitive>(nu);
      assertType<Primitive>(u);

      expect(typeof s).toBe('string');
      expect(typeof n).toBe('number');
      expect(typeof b).toBe('boolean');
      expect(typeof sy).toBe('symbol');
      expect(nu).toBeNull();
      expect(u).toBeUndefined();

      // @ts-expect-error - object is not a primitive
      // const obj: Primitive = {};
      // @ts-expect-error - array is not a primitive
      // const arr: Primitive = [];
    });
  });

  describe('KeyOf', () => {
    interface MyObject {
      propA: string;
      propB: number;
    }
    type MyObjectKeys = KeyOf<MyObject>;

    it('should extract keys as a union of string literals', () => {
      assertType<MyObjectKeys>('propA');
      assertType<MyObjectKeys>('propB');

      // @ts-expect-error - not a key of MyObject
      // assertType<MyObjectKeys>('propC');

      const key: MyObjectKeys = 'propA';
      expect(key).toBe('propA');
    });
  });

  describe('DeepPartial', () => {
    interface Person {
      name: string;
      age: number;
      address: {
        street: string;
        city: string;
        zip?: string;
      };
      hobbies: string[];
    }
    type PartialPerson = DeepPartial<Person>;

    it('should make all properties optional, including nested objects', () => {
      const p1: PartialPerson = {};
      const p2: PartialPerson = {
        name: 'John',
        address: { city: 'London' }
      };
      const p3: PartialPerson = {
        hobbies: ['reading']
      };

      assertType<PartialPerson>(p1);
      assertType<PartialPerson>(p2);
      assertType<PartialPerson>(p3);

      expect(p1).toEqual({});
      expect(p2).toEqual({ name: 'John', address: { city: 'London' } });
      expect(p3).toEqual({ hobbies: ['reading'] });

      // @ts-expect-error - age is optional now
      // const badPerson: Person = { name: 'Alice', address: { street: 'Main St', city: 'Anytown' } };

      // Ensure that original type is assignable to deep partial
      const fullPerson: Person = {
        name: 'Jane',
        age: 25,
        address: { street: 'Oak Ave', city: 'Villagetown' },
        hobbies: ['swimming']
      };
      assertType<PartialPerson>(fullPerson);
    });

    it('should not make array elements partial', () => {
      const p: PartialPerson = {
        hobbies: ['coding', 'gaming']
      };
      assertType<string[] | undefined>(p.hobbies);
      // @ts-expect-error - hobbies elements are still strings
      // const badHobbies: PartialPerson = { hobbies: [123] };
      expect(p.hobbies).toEqual(['coding', 'gaming']);
    });
  });

  describe('Branded', () => {
    type UserID = Branded<string, 'UserID'>;
    type ProductID = Branded<string, 'ProductID'>;
    type Quantity = Branded<number, 'Quantity'>;

    const createUserID = (id: string): UserID => id as UserID;
    const createProductID = (id: string): ProductID => id as ProductID;
    const createQuantity = (q: number): Quantity => q as Quantity;

    it('should prevent assigning different branded types', () => {
      const userID: UserID = createUserID('user-123');
      const productID: ProductID = createProductID('prod-456');

      assertType<UserID>(userID);
      assertType<ProductID>(productID);
      expect(userID).toBe('user-123');
      expect(productID).toBe('prod-456');

      // @ts-expect-error - Cannot assign ProductID to UserID
      // const anotherUserID: UserID = productID;

      // @ts-expect-error - Cannot assign string to UserID without branding
      // const unbrandedString: UserID = 'some-string';

      // However, branded type can be used as its base type
      const plainString: string = userID;
      expect(plainString).toBe('user-123');
      assertType<string>(plainString);
    });

    it('should work with number base types', () => {
      const q1: Quantity = createQuantity(10);
      assertType<Quantity>(q1);
      expect(q1).toBe(10);

      // @ts-expect-error - Cannot assign number to Quantity without branding
      // const unbrandedNumber: Quantity = 5;

      // Can be used as its base type
      const plainNumber: number = q1;
      expect(plainNumber).toBe(10);
      assertType<number>(plainNumber);
    });
  });
});