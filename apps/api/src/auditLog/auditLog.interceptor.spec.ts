import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { Repository } from 'typeorm';

import { Client } from '../clients/entities/client.entity';
import { Loan } from '../loans/entities/loan.entity';

import { AuditLogInterceptor } from './auditLog.interceptor';
import { AuditLogService } from './auditLog.service';

// The interceptor now does its audit write inside an async IIFE (to
// `await resolveEntityLabel` before calling record — see that method's
// occasional DB lookup), rather than calling record() synchronously
// inside tap() the way it used to. That means `record` is no longer
// guaranteed to have been called by the time `firstValueFrom` resolves —
// tests that assert on `record` need to flush the microtask/macrotask
// queue first. Fire-and-forget code is still fire-and-forget in
// production (nothing here changes that); this is purely a test concern.
const flushPromises = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let auditLogService: { record: jest.Mock };
  let reflector: { get: jest.Mock };
  let clientsRepository: { findOne: jest.Mock };
  let loansRepository: { findOne: jest.Mock };

  const buildContext = (overrides: {
    user?: { id: string };
    params?: Record<string, string>;
    body?: unknown;
  }): ExecutionContext => {
    const request = {
      user: overrides.user,
      params: overrides.params ?? {},
      body: overrides.body ?? {},
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  // Explicitly Observable<unknown>, not ReturnType<typeof of> — of() is
  // overloaded, and TS resolves ReturnType against its last (zero-arg)
  // overload, Observable<never>, which then rejects every real call site
  // below (each passes an Observable of some concrete object shape).
  const buildCallHandler = (observable: Observable<unknown>): CallHandler => ({
    handle: () => observable,
  });

  beforeEach(() => {
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    reflector = { get: jest.fn() };
    // Defaults to "not found" — only the client.addReference/
    // updateReference/removeReference fallback path ever calls this, and
    // most tests below don't exercise that path at all.
    clientsRepository = { findOne: jest.fn().mockResolvedValue(null) };
    // Defaults to "not found" — only loan.delete's fallback path (the
    // handler returns void, so there's no promissoryNoteNumber on the
    // response) ever calls this; most tests below don't exercise it.
    loansRepository = { findOne: jest.fn().mockResolvedValue(null) };
    interceptor = new AuditLogInterceptor(
      reflector as unknown as Reflector,
      auditLogService as unknown as AuditLogService,
      clientsRepository as unknown as Repository<Client>,
      loansRepository as unknown as Repository<Loan>,
    );
  });

  it('passes through untouched when the endpoint has no @Audit() metadata', async () => {
    reflector.get.mockReturnValue(undefined);
    const context = buildContext({});
    const handler = buildCallHandler(of({ id: 'x' }));

    const result = await firstValueFrom(
      interceptor.intercept(context, handler),
    );

    expect(result).toEqual({ id: 'x' });
    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  it('records the actor, action, entityType, entityId and entityLabel on success', async () => {
    reflector.get.mockReturnValue({
      action: 'client.create',
      entityType: 'client',
    });
    const context = buildContext({
      user: { id: 'user-1' },
      params: {},
      body: { firstName: 'Juana' },
    });
    const handler = buildCallHandler(
      of({ id: 'client-1', firstName: 'Juana', lastName: 'Pérez' }),
    );

    await firstValueFrom(interceptor.intercept(context, handler));
    await flushPromises();

    expect(auditLogService.record).toHaveBeenCalledWith({
      actorUserId: 'user-1',
      action: 'client.create',
      entityType: 'client',
      entityId: 'client-1',
      entityLabel: 'Juana Pérez',
      metadata: { params: {}, body: { firstName: 'Juana' } },
    });
  });

  it('falls back to the route param id when the response has none (e.g. a 204 delete)', async () => {
    reflector.get.mockReturnValue({
      action: 'client.deactivate',
      entityType: 'client',
    });
    const context = buildContext({
      user: { id: 'user-1' },
      params: { id: 'client-1' },
    });
    const handler = buildCallHandler(of(undefined));

    await firstValueFrom(interceptor.intercept(context, handler));
    await flushPromises();

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'client-1' }),
    );
  });

  // Regression case: POST /installments/:id/payments — the route's :id is
  // the INSTALLMENT being paid, not the payment being created. Using the
  // response's id instead avoids logging payment.register entries against
  // the wrong entity.
  it('prefers the response id over a mismatched route param', async () => {
    reflector.get.mockReturnValue({
      action: 'payment.register',
      entityType: 'payment',
    });
    const context = buildContext({
      user: { id: 'user-1' },
      params: { id: 'installment-1' },
    });
    const handler = buildCallHandler(of({ id: 'payment-1', amountPaid: 100 }));

    await firstValueFrom(interceptor.intercept(context, handler));
    await flushPromises();

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'payment-1' }),
    );
  });

  it('records null actorUserId when there is no authenticated user', async () => {
    reflector.get.mockReturnValue({
      action: 'client.create',
      entityType: 'client',
    });
    const context = buildContext({ params: {}, body: {} });
    const handler = buildCallHandler(of({ id: 'client-1' }));

    await firstValueFrom(interceptor.intercept(context, handler));
    await flushPromises();

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: null }),
    );
  });

  it('redacts password-like fields from the logged request body', async () => {
    reflector.get.mockReturnValue({
      action: 'user.create',
      entityType: 'user',
    });
    const context = buildContext({
      user: { id: 'admin-1' },
      params: {},
      body: { email: 'a@b.com', password: 'super-secret' },
    });
    const handler = buildCallHandler(of({ id: 'user-1', email: 'a@b.com' }));

    await firstValueFrom(interceptor.intercept(context, handler));
    await flushPromises();

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          params: {},
          body: { email: 'a@b.com', password: '[redacted]' },
        },
      }),
    );
  });

  it('does not log anything when the request itself fails', async () => {
    reflector.get.mockReturnValue({
      action: 'loan.create',
      entityType: 'loan',
    });
    const context = buildContext({
      user: { id: 'user-1' },
      params: {},
      body: {},
    });
    const handler = buildCallHandler(throwError(() => new Error('rejected')));

    await expect(
      firstValueFrom(interceptor.intercept(context, handler)),
    ).rejects.toThrow('rejected');
    await flushPromises();
    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  it('does not fail the request when the audit write itself fails', async () => {
    auditLogService.record.mockRejectedValue(new Error('db down'));
    reflector.get.mockReturnValue({
      action: 'client.create',
      entityType: 'client',
    });
    const context = buildContext({
      user: { id: 'user-1' },
      params: {},
      body: {},
    });
    const handler = buildCallHandler(of({ id: 'client-1' }));

    const result = await firstValueFrom(
      interceptor.intercept(context, handler),
    );
    await flushPromises();

    expect(result).toEqual({ id: 'client-1' });
  });

  // resolveEntityLabel — client feedback on Auditoría: "Cliente" alone,
  // or "Préstamo" alone, doesn't say WHICH one. See AuditLog.entityLabel.
  describe('entityLabel resolution', () => {
    it('builds a "name (CC document)" label for direct client actions', async () => {
      reflector.get.mockReturnValue({
        action: 'client.update',
        entityType: 'client',
      });
      const context = buildContext({ user: { id: 'user-1' }, params: {} });
      const handler = buildCallHandler(
        of({
          id: 'client-1',
          firstName: 'Carlos',
          lastName: 'Gómez',
          documentNumber: '1234567890',
        }),
      );

      await firstValueFrom(interceptor.intercept(context, handler));
      await flushPromises();

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityLabel: 'Carlos Gómez (CC 1234567890)',
        }),
      );
    });

    // client.addReference/updateReference/removeReference return the
    // ClientReference row, not the Client — no client name on the
    // response, so this falls back to looking the client up by the
    // route's :id (always the client, even on these sub-routes).
    it('falls back to a client lookup by route id for reference sub-actions', async () => {
      reflector.get.mockReturnValue({
        action: 'client.addReference',
        entityType: 'client',
      });
      clientsRepository.findOne.mockResolvedValue({
        id: 'client-1',
        firstName: 'Ana',
        lastName: 'Ruiz',
        documentNumber: '999',
      });
      const context = buildContext({
        user: { id: 'user-1' },
        params: { id: 'client-1' },
      });
      const handler = buildCallHandler(
        of({ id: 'reference-1', fullName: 'Hermano de Ana' }),
      );

      await firstValueFrom(interceptor.intercept(context, handler));
      await flushPromises();

      expect(clientsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        withDeleted: true,
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ entityLabel: 'Ana Ruiz (CC 999)' }),
      );
    });

    it('resolves a null entityLabel when the reference-lookup client is gone', async () => {
      reflector.get.mockReturnValue({
        action: 'client.removeReference',
        entityType: 'client',
      });
      clientsRepository.findOne.mockResolvedValue(null);
      const context = buildContext({
        user: { id: 'user-1' },
        params: { id: 'client-1', referenceId: 'reference-1' },
      });
      const handler = buildCallHandler(of(undefined));

      await firstValueFrom(interceptor.intercept(context, handler));
      await flushPromises();

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ entityLabel: null }),
      );
    });

    it('labels a loan by its pagaré number', async () => {
      reflector.get.mockReturnValue({
        action: 'loan.refinance',
        entityType: 'loan',
      });
      const context = buildContext({ user: { id: 'user-1' }, params: {} });
      const handler = buildCallHandler(
        of({ id: 'loan-1', promissoryNoteNumber: '743' }),
      );

      await firstValueFrom(interceptor.intercept(context, handler));
      await flushPromises();

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ entityLabel: 'Pagaré #743' }),
      );
    });

    // loan.delete (Phase 30) returns void (204 No Content) — no
    // promissoryNoteNumber on the response, so this falls back to a
    // withDeleted lookup by the route's :id, mirroring the client
    // reference-sub-action fallback above.
    it('falls back to a loan lookup by route id when the response has no entity', async () => {
      reflector.get.mockReturnValue({
        action: 'loan.delete',
        entityType: 'loan',
      });
      loansRepository.findOne.mockResolvedValue({
        id: 'loan-1',
        promissoryNoteNumber: '743',
      });
      const context = buildContext({
        user: { id: 'user-1' },
        params: { id: 'loan-1' },
      });
      const handler = buildCallHandler(of(undefined));

      await firstValueFrom(interceptor.intercept(context, handler));
      await flushPromises();

      expect(loansRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'loan-1' },
        withDeleted: true,
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ entityLabel: 'Pagaré #743' }),
      );
    });

    it('resolves a null entityLabel when the loan-lookup fallback finds nothing', async () => {
      reflector.get.mockReturnValue({
        action: 'loan.delete',
        entityType: 'loan',
      });
      loansRepository.findOne.mockResolvedValue(null);
      const context = buildContext({
        user: { id: 'user-1' },
        params: { id: 'loan-1' },
      });
      const handler = buildCallHandler(of(undefined));

      await firstValueFrom(interceptor.intercept(context, handler));
      await flushPromises();

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ entityLabel: null }),
      );
    });

    it('labels a payment by its amount and paid date', async () => {
      reflector.get.mockReturnValue({
        action: 'payment.register',
        entityType: 'payment',
      });
      const context = buildContext({
        user: { id: 'user-1' },
        params: { id: 'installment-1' },
      });
      const handler = buildCallHandler(
        of({ id: 'payment-1', amountPaid: 150000, paidAt: '2026-08-18' }),
      );

      await firstValueFrom(interceptor.intercept(context, handler));
      await flushPromises();

      // Avoids indexing into `auditLogService.record.mock.calls` directly
      // (that's `any` — jest's Mock type doesn't know record()'s param
      // shape here — and eslint's no-unsafe-* rules correctly reject
      // reading properties off it). expect.objectContaining +
      // stringContaining/stringMatching checks the same thing type-safely.
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityLabel: expect.stringContaining('2026-08-18') as unknown,
        }),
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityLabel: expect.stringMatching(/Pago de/) as unknown,
        }),
      );
    });

    it('labels a user by full name and email', async () => {
      reflector.get.mockReturnValue({
        action: 'user.deactivate',
        entityType: 'user',
      });
      const context = buildContext({
        user: { id: 'admin-1' },
        params: { id: 'user-1' },
      });
      const handler = buildCallHandler(
        of({ id: 'user-1', fullName: 'Laura Díaz', email: 'laura@x.com' }),
      );

      await firstValueFrom(interceptor.intercept(context, handler));
      await flushPromises();

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityLabel: 'Laura Díaz (laura@x.com)',
        }),
      );
    });

    it('labels a usury rate by percentage and month', async () => {
      reflector.get.mockReturnValue({
        action: 'usuryRate.create',
        entityType: 'usuryRate',
      });
      const context = buildContext({ user: { id: 'admin-1' }, params: {} });
      const handler = buildCallHandler(
        of({
          id: 'rate-1',
          ratePercentage: 28.5,
          effectiveMonth: '2026-08-01',
        }),
      );

      await firstValueFrom(interceptor.intercept(context, handler));
      await flushPromises();

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityLabel: '28.5% desde 2026-08-01',
        }),
      );
    });

    it('resolves a null entityLabel for an entityType with no labeling rule', async () => {
      reflector.get.mockReturnValue({
        action: 'something.new',
        entityType: 'somethingElse',
      });
      const context = buildContext({ user: { id: 'user-1' }, params: {} });
      const handler = buildCallHandler(of({ id: 'x-1' }));

      await firstValueFrom(interceptor.intercept(context, handler));
      await flushPromises();

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ entityLabel: null }),
      );
    });
  });
});
