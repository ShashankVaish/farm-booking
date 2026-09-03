import { ConfigService } from '@nestjs/config';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const config = {
    get: jest.fn().mockReturnValue(10),
  } as unknown as ConfigService;

  const service = new PasswordService(config);

  it('hashes and verifies a password', async () => {
    const hash = await service.hash('Secret123');
    expect(hash).not.toBe('Secret123');
    await expect(service.compare('Secret123', hash)).resolves.toBe(true);
    await expect(service.compare('wrong', hash)).resolves.toBe(false);
  });
});
