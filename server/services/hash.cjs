<<<<<<< HEAD

=======
>>>>>>> b9647a007683f23089e1a45c47a4fdac9815b1af
const bcrypt = require('bcryptjs');

exports.hashPassword = async (plain) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
};
<<<<<<< HEAD
=======

>>>>>>> b9647a007683f23089e1a45c47a4fdac9815b1af
exports.comparePassword = (plain, hash) => bcrypt.compare(plain, hash);