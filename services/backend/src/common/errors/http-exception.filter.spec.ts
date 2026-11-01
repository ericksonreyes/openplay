import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { ApiExceptionFilter } from './http-exception.filter';
import { RecordNotFoundException } from './api-error';

const host = (req: object, res: object): ArgumentsHost =>
  ({
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  }) as unknown as ArgumentsHost;

const fakeRes = () => {
  const res: {
    statusCode?: number;
    body?: unknown;
    contentType?: string;
    status: (n: number) => typeof res;
    type: (t: string) => typeof res;
    json: (b: unknown) => void;
  } = {
    status(n: number) {
      res.statusCode = n;
      return res;
    },
    type(t: string) {
      res.contentType = t;
      return res;
    },
    json(b: unknown) {
      res.body = b;
    },
  };
  return res;
};

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  it('emits a JSON:API error document for HTTP exceptions', () => {
    const res = fakeRes();
    filter.catch(new NotFoundException('Not found'), host({ requestId: 'req-1' }, res));
    expect(res.statusCode).toBe(404);
    expect(res.contentType).toBe('application/vnd.api+json');
    expect(res.body).toEqual({
      errors: [
        {
          status: '404',
          code: 'NOT_FOUND',
          title: 'Not Found',
          detail: 'Not found',
          meta: { request_id: 'req-1' },
        },
      ],
    });
  });

  it('masks unhandled errors as INTERNAL without leaking the message', () => {
    const res = fakeRes();
    filter.catch(new Error('database connection refused at 10.0.0.5'), host({ requestId: 'r' }, res));
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      errors: [{ code: 'INTERNAL', detail: 'Internal server error' }],
    });
  });

  it('RecordNotFoundException is a plain 404', () => {
    const res = fakeRes();
    filter.catch(new RecordNotFoundException(), host({}, res));
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ errors: [{ code: 'NOT_FOUND' }] });
  });
});
