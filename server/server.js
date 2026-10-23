require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add it to server/.env');
  process.exit(1);
}

const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
