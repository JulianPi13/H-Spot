const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
module.exports = {
  ROOT,
  FRONTEND: path.join(ROOT, 'frontend'),
  UPLOADS: path.join(ROOT, 'backend', 'uploads'),
};
