/**
 * PluginRouter passes controller methods to Express UNBOUND, e.g.
 *
 *   this.post(..., this.lifecycleController.toggle);
 *
 * That only works because BaseController binds subclass methods during construction. When
 * PluginLifecycleController was split out of PluginController on 2026-09-09 it did not extend
 * BaseController, so `this` was `undefined` inside every one of its handlers and the first property
 * access threw:
 *
 *   TypeError: Cannot read properties of undefined (reading 'toggleForTenant')
 *
 * Observed in production on 2026-09-14: enabling ANY plugin from the console returned
 * "Toggle Failed". PluginUploadController had the same defect, breaking the upload/install routes.
 *
 * The bug is invisible to a typecheck and to any test that calls `controller.toggle(...)` on the
 * instance — it only appears when the method is detached, which is exactly what the router does.
 * So this test detaches them.
 */

import { describe, it, expect } from 'vitest';
import { BaseController } from '@fromcode119/core';
import { PluginLifecycleController } from '@api/controllers/plugins/plugin-lifecycle-controller';
import { PluginUploadController } from '@api/controllers/plugins/plugin-upload-controller';

const managerStub: any = { db: {}, schemaDb: {} };

/**
 * The assertion is structural on purpose: BaseController binds by assigning an OWN property that
 * shadows the prototype method. So a bound handler is an own property and is NOT identical to the
 * prototype's. Checking that — rather than invoking the handler — proves the binding without running
 * any controller logic, so the test needs no request/response fixtures and has no side effects.
 */
describe('plugin controllers passed unbound by PluginRouter', () => {
  const cases: Array<[string, any, string[]]> = [
    ['PluginLifecycleController', PluginLifecycleController, ['toggle', 'reapproveAll', 'delete']],
    ['PluginUploadController', PluginUploadController, [
      'upload', 'startUploadSession', 'uploadChunk', 'inspectUpload', 'inspectStagedUpload', 'completeStagedUpload',
    ]],
  ];

  for (const [name, Ctor, handlers] of cases) {
    describe(name, () => {
      it('extends BaseController, which is what binds the handlers', () => {
        expect(Object.create(Ctor.prototype)).toBeInstanceOf(BaseController);
      });

      for (const handler of handlers) {
        it(`binds \`${handler}\` so it survives being detached`, () => {
          const instance: any = new Ctor(managerStub);
          expect(typeof Ctor.prototype[handler]).toBe('function');
          expect(Object.prototype.hasOwnProperty.call(instance, handler)).toBe(true);
          expect(instance[handler]).not.toBe(Ctor.prototype[handler]);
        });
      }
    });
  }
});
