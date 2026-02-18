const { User, USER_ROLES } = require('../models/User');

const listUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 }).select('username email role isActive createdAt');
    return res.json(users);
  } catch (error) {
    return next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = String(req.body.role || '').trim();
    const password = String(req.body.password || '');

    if (!username || !email || !role || !password) {
      return res.status(400).json({ error: 'username, email, role and password are required' });
    }

    if (!Object.values(USER_ROLES).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      username,
      email,
      role,
      passwordHash,
      isActive: true,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listUsers,
  createUser,
};
