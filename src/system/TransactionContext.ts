import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import prisma, { AppPrismaClient } from '@database/Prisma';

export type Propagation =
  | 'REQUIRED'
  | 'REQUIRES_NEW'
  | 'MANDATORY'
  | 'SUPPORTS'
  | 'NEVER';

export interface TxStore {
  tx: AppPrismaClient;
  txId: string;
  depth: number;
  startedAt: number;
  readOnly: boolean;
}

export class TransactionContext {
  private static storage = new AsyncLocalStorage<TxStore>();

  // =============================
  // PUBLIC HELPERS
  // =============================

  static getClient(): AppPrismaClient {
    return this.storage.getStore()?.tx ?? prisma;
  }

  static getTxId(): string | undefined {
    return this.storage.getStore()?.txId;
  }

  static isActive(): boolean {
    return !!this.storage.getStore();
  }

  static requireActive() {
    if (!this.storage.getStore()) {
      throw new Error('No active transaction context.');
    }
  }

  static isReadOnly(): boolean {
    return this.storage.getStore()?.readOnly ?? false;
  }

  // =============================
  // DECORATOR
  // =============================

  static Transactional(options?: {
    propagation?: Propagation;
    isolationLevel?: Prisma.TransactionIsolationLevel;
    readOnly?: boolean;
  }) {
    const defaultOptions = {
      propagation: 'REQUIRED' as Propagation,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      readOnly: false,
    };

    const finalOptions = {
      ...defaultOptions,
      ...options,
    };

    return function Transactional(
      target: unknown,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ) {
      const originalMethod = descriptor.value;
      const newDescriptor = { ...descriptor };

      newDescriptor.value = async function transactionalMethod(
        ...args: unknown[]
      ) {
        const existingStore = TransactionContext.storage.getStore();

        // ===== PROPAGATION RULES =====

        if (finalOptions.propagation === 'MANDATORY' && !existingStore) {
          throw new Error('Transaction required but none exists.');
        }

        if (finalOptions.propagation === 'NEVER' && existingStore) {
          throw new Error('Transaction exists but propagation is NEVER.');
        }

        if (finalOptions.propagation === 'SUPPORTS') {
          return originalMethod.apply(this, args);
        }

        if (finalOptions.propagation === 'REQUIRED' && existingStore) {
          existingStore.depth += 1;
          try {
            return originalMethod.apply(this, args);
          } finally {
            existingStore.depth -= 1;
          }
        }

        // ===== START NEW TRANSACTION =====

        return prisma.$transaction(
          async (tx) => {
            const store: TxStore = {
              tx: tx as AppPrismaClient, // safe cast (inherits extensions)
              txId: randomUUID(),
              depth: 1,
              startedAt: Date.now(),
              readOnly: finalOptions.readOnly,
            };

            return TransactionContext.storage.run(store, async () => {
              const result = await originalMethod.apply(this, args);

              const duration = Date.now() - store.startedAt;

              if (duration > 500) {
                console.warn(
                  `[TX ${store.txId}] Slow transaction detected: ${duration}ms`,
                );
              }

              return result;
            });
          },
          {
            isolationLevel: finalOptions.isolationLevel,
          },
        );
      };

      return newDescriptor;
    };
  }
}
