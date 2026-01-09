import express from 'express';
import bodyParser from 'body-parser';
import methodOverride from 'method-override';
import moment from 'moment';
import db from './models/index.cjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { engine } from 'express-handlebars';
import routes from './controllers/bizDb_controller.js';
import apiRoutes from './routes/api-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Serve static content for the app from the "public" directory in the application directory.
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.text());
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));

// override with POST having ?_method=DELETE
app.use(methodOverride('_method'));

app.engine('handlebars', engine({
  defaultLayout: 'main'
}));

app.set('view engine', 'handlebars');

apiRoutes(app);

app.use('/', routes);
app.use('/select', routes);
const port = process.env.PORT || 3000;
db.sequelize.sync().then(function() {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
