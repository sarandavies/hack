import { handleRequest } from '../server/main';

export default {
  fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  },
};
