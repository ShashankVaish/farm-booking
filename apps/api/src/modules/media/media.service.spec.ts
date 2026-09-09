import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { MediaService } from './media.service';

describe('MediaService', () => {
  const service = new MediaService();
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const uploads = join(process.cwd(), 'uploads');

  afterAll(async () => {
    await rm(uploads, { recursive: true, force: true }).catch(() => undefined);
    await mkdir(uploads, { recursive: true });
  });

  it('rejects non-image files', async () => {
    await expect(
      service.saveListingImage({
        mimetype: 'application/pdf',
        originalname: 'doc.pdf',
        buffer: Buffer.from('x'),
      } as Express.Multer.File),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'VALIDATION_ERROR' }),
    });
  });

  it('ignores client filenames and stores a uuid jpeg', async () => {
    const result = await service.saveListingImage({
      mimetype: 'image/jpeg',
      originalname: '../../../evil.html',
      buffer: jpeg,
    } as Express.Multer.File);
    expect(result.url).toMatch(/^\/uploads\/[0-9a-f-]+\.jpg$/);
    expect(result.url).not.toContain('..');
    expect(result.url).not.toContain('.html');
  });
});
