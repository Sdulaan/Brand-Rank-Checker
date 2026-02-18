const express = require('express');
const { listUsers, createUser } = require('../controllers/userController');

const createUserRoutes = (authMiddleware, roles) => {
  const router = express.Router();

  router.use(authMiddleware.authenticate);
  router.use(authMiddleware.authorizeRoles(roles.ADMIN));

  router.get('/', listUsers);
  router.post('/', createUser);

  return router;
};

module.exports = createUserRoutes;
