import axios from 'axios';

describe('DB Init API', () => {
  describe('GET /', () => {
    it('should return hello message', async () => {
      const res = await axios.get(`/`);

      expect(res.status).toBe(200);
      expect(res.data).toBe('Hello World!');
    });
  });
});
