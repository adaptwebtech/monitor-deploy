describe('bcrypt spyOn with patched jest-mock', () => {
  it('spy works', async () => {
    const bcrypt = await import('bcrypt');
    const spy = jest.spyOn(bcrypt, 'genSalt');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cjsBcrypt = require('bcrypt');
    await cjsBcrypt.genSalt(10);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
