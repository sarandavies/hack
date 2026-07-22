import { handleRequest } from '../server/main.js';

export default {
  fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  },
};
