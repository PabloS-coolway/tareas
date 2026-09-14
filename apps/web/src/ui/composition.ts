import { HttpAuthGateway } from '../infrastructure/http-auth-gateway';
import { HttpUsersGateway } from '../infrastructure/http-users-gateway';
import { HttpRolesGateway } from '../infrastructure/http-roles-gateway';
import { HttpTareasGateway } from '../infrastructure/http-tareas-gateway';
import { HttpTokensGateway } from '../infrastructure/http-tokens-gateway';

/** Raíz de composición: instancia los adapters concretos para los puertos. */
export const authGateway = new HttpAuthGateway();
export const usersGateway = new HttpUsersGateway();
export const rolesGateway = new HttpRolesGateway();
export const tareasGateway = new HttpTareasGateway();
export const tokensGateway = new HttpTokensGateway();
