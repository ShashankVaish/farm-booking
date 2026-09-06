import { MediaService } from './media.service';

describe('MediaService', () => {
  const service = new MediaService();

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
});
