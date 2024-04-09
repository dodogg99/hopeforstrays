import express from "express";
// import mysql from 'mysql2/promise';
import createError from "http-errors";
import logger from 'morgan';
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import indexRouter from "./route/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use('/', indexRouter);

app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});