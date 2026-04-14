
import { PluginSettingsController } from '../src/controllers/plugins/plugin-settings-controller';

describe('plugin-settings-controller', () => {
  let controller: PluginSettingsController;
  let mockPluginManager: any;

  beforeEach(() => {
    mockPluginManager = {
      getPlugins: jest.fn().mockReturnValue([
        {
          manifest: {
            slug: 'test-plugin',
            config: {
              settings: {
                existingKey: 'existingValue'
              }
            }
          }
        }
      ]),
      getPluginSettings: jest.fn().mockReturnValue({
        fields: [
          { name: 'existingKey', type: 'text', defaultValue: 'default' },
          { name: 'newKey', type: 'text', defaultValue: 'newValue' }
        ]
      }),
      savePluginConfig: jest.fn().mockResolvedValue(true),
      emit: jest.fn(),
      createContext: jest.fn().mockReturnValue({})
    };
    controller = new PluginSettingsController(mockPluginManager);
  });

  describe('getSettings', () => {
    it('returns merged settings for a valid plugin', async () => {
      const req: any = { params: { slug: 'test-plugin' } };
      const res: any = { json: jest.fn() };

      await controller.getSettings(req, res);

      expect(res.json).toHaveBeenCalledWith({
        settings: {
          existingKey: 'existingValue',
          newKey: 'newValue'
        }
      });
    });

    it('returns 404 for unknown plugin', async () => {
      const req: any = { params: { slug: 'unknown' } };
      const res: any = { 
        status: jest.fn().mockReturnThis(),
        json: jest.fn() 
      };

      await controller.getSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateSettings', () => {
    it('updates settings and emits event', async () => {
      const req: any = { 
        params: { slug: 'test-plugin' },
        body: { existingKey: 'updatedValue' }
      };
      const res: any = { json: jest.fn() };

      await controller.updateSettings(req, res);

      expect(mockPluginManager.savePluginConfig).toHaveBeenCalledWith('test-plugin', expect.objectContaining({
        settings: { existingKey: 'updatedValue' }
      }));
      expect(mockPluginManager.emit).toHaveBeenCalledWith('plugin:settings:updated', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({ success: true, settings: { existingKey: 'updatedValue' } });
    });

    it('validates settings based on schema', async () => {
      mockPluginManager.getPluginSettings.mockReturnValue({
        fields: [
          { name: 'count', type: 'number', min: 10 }
        ]
      });

      const req: any = { 
        params: { slug: 'test-plugin' },
        body: { count: 5 }
      };
      const res: any = { 
        status: jest.fn().mockReturnThis(),
        json: jest.fn() 
      };

      await controller.updateSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: { count: 'Must be at least 10' }
      });
    });
  });

  describe('resetSettings', () => {
    it('resets settings to defaults', async () => {
      const req: any = { params: { slug: 'test-plugin' } };
      const res: any = { json: jest.fn() };

      await controller.resetSettings(req, res);

      expect(mockPluginManager.savePluginConfig).toHaveBeenCalledWith('test-plugin', expect.objectContaining({
        settings: { existingKey: 'default', newKey: 'newValue' }
      }));
    });
  });

  describe('exportSettings', () => {
    it('successfully exports settings as JSON', async () => {
      const req: any = { params: { slug: 'test-plugin' } };
      const res: any = { 
        setHeader: jest.fn(),
        send: jest.fn() 
      };

      await controller.exportSettings(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('"existingKey": "existingValue"'));
    });
  });

  describe('importSettings', () => {
    it('successfully imports valid settings', async () => {
      const req: any = { 
        params: { slug: 'test-plugin' },
        body: { existingKey: 'importedValue', newKey: 'other' }
      };
      const res: any = { json: jest.fn() };

      await controller.importSettings(req, res);

      expect(mockPluginManager.savePluginConfig).toHaveBeenCalledWith('test-plugin', expect.objectContaining({
        settings: { existingKey: 'importedValue', newKey: 'other' }
      }));
      expect(res.json).toHaveBeenCalledWith({ success: true, imported: 2 });
    });

    it('fails import if validation fails', async () => {
      mockPluginManager.getPluginSettings.mockReturnValue({
        fields: [{ name: 'count', type: 'number', required: true }]
      });

      const req: any = { 
        params: { slug: 'test-plugin' },
        body: { count: 'not-a-number' }
      };
      const res: any = { 
        status: jest.fn().mockReturnThis(),
        json: jest.fn() 
      };

      await controller.importSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: { count: 'Must be a number' }
      });
    });
  });
});
