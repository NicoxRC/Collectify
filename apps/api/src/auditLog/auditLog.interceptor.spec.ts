import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';

import { AuditLogInterceptor } from './auditLog.interceptor';
import { AuditLogService } from './auditLog.service';

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let auditLogService: { record: jest.Mock };
  let reflector: { get: jest.Mock };

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
    interceptor = new AuditLogInterceptor(
      reflector as unknown as Reflector,
      auditLogService as unknown as AuditLogService,
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

  it('records the actor, action, entityType and entityId on success', async () => {
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
      of({ id: 'client-1', firstName: 'Juana' }),
    );

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(auditLogService.record).toHaveBeenCalledWith({
      actorUserId: 'user-1',
      action: 'client.create',
      entityType: 'client',
      entityId: 'client-1',
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

    expect(result).toEqual({ id: 'client-1' });
  });
});
