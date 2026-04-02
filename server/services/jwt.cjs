<<<<<<< HEAD

=======
>>>>>>> b9647a007683f23089e1a45c47a4fdac9815b1af
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || 'dev_secret';

exports.sign = (payload, expiresIn = '7d') => jwt.sign(payload, secret, { expiresIn });
exports.verify = (token) => jwt.verify(token, secret);