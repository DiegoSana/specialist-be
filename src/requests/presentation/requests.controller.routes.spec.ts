import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { RequestsController } from './requests.controller';

/**
 * Nest registers routes in declaration order, so a static GET path declared after
 * `GET :id` is shadowed by it (e.g. `GET /requests/interested` would hit `:id`).
 */
describe('RequestsController route order', () => {
  const proto = RequestsController.prototype as any;
  const getPaths = Object.getOwnPropertyNames(proto)
    .filter(
      (name) =>
        typeof proto[name] === 'function' &&
        Reflect.getMetadata(METHOD_METADATA, proto[name]) === RequestMethod.GET,
    )
    .map((name) => Reflect.getMetadata(PATH_METADATA, proto[name]) as string);

  it('declares every static single-segment GET route before GET :id', () => {
    const idIndex = getPaths.indexOf(':id');
    expect(idIndex).toBeGreaterThanOrEqual(0);
    const staticAfterId = getPaths
      .slice(idIndex + 1)
      .filter((path) => path !== '' && !path.includes('/') && path !== ':id');
    expect(staticAfterId).toEqual([]);
    expect(getPaths.indexOf('interested')).toBeGreaterThanOrEqual(0);
    expect(getPaths.indexOf('interested')).toBeLessThan(idIndex);
  });
});
