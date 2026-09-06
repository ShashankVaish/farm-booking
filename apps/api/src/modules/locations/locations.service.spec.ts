import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  const geocoder = {
    name: 'manual',
    search: jest.fn().mockResolvedValue([
      {
        displayName: 'Pune, Maharashtra',
        city: 'Pune',
        state: 'Maharashtra',
        latitude: 18.52,
        longitude: 73.85,
      },
    ]),
    reverse: jest.fn().mockResolvedValue({
      displayName: 'Confirmed pin',
      address: 'Koregaon Park',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      pincode: '411001',
      latitude: 18.52,
      longitude: 73.85,
    }),
  };

  const service = new LocationsService(geocoder);

  beforeEach(() => {
    jest.clearAllMocks();
    geocoder.search.mockResolvedValue([
      {
        displayName: 'Pune, Maharashtra',
        city: 'Pune',
        state: 'Maharashtra',
        latitude: 18.52,
        longitude: 73.85,
      },
    ]);
    geocoder.reverse.mockResolvedValue({
      displayName: 'Confirmed pin',
      address: 'Koregaon Park',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      pincode: '411001',
      latitude: 18.52,
      longitude: 73.85,
    });
  });

  it('searches locations through the geocoding provider', async () => {
    const results = await service.search('Pune');
    expect(geocoder.search).toHaveBeenCalledWith('Pune');
    expect(results[0].city).toBe('Pune');
  });

  it('confirms a map pin and stores human-readable address fields', async () => {
    const confirmed = await service.confirm({
      latitude: 18.52,
      longitude: 73.85,
    });
    expect(confirmed.confirmed).toBe(true);
    expect(confirmed.latitude).toBe(18.52);
    expect(confirmed.pincode).toBe('411001');
    expect(confirmed.address).toBe('Koregaon Park');
  });

  it('rejects an invalid pin before calling the provider', async () => {
    await expect(
      service.confirm({ latitude: 0, longitude: 0 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'INVALID_COORDINATES' }),
    });
    expect(geocoder.reverse).not.toHaveBeenCalled();
  });
});
