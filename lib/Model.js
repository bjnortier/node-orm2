var Instance       = require("./Instance").Instance;
var Singleton      = require("./Singleton");
var OneAssociation = require("./Associations/One");

exports.Model = Model;

function Model(opts) {
	opts = opts || {};
	opts.id = opts.id || "id";

	var model = function (data) {
		return new Instance({
			data        : data,
			autoSave    : opts.autoSave,
			driver      : opts.driver,
			table       : opts.table,
			hooks       : opts.hooks,
			validations : opts.validations
		});
	};
	var one_associations = [];

	OneAssociation.prepare(model, one_associations);

	model.get = function (id, cb) {
		var conditions = {};
		conditions[opts.id] = id;

		opts.driver.find(opts.table, conditions, 1, null, function (err, data) {
			if (err) {
				return cb(err);
			}
			if (data.length === 0) {
				return cb(new Error("Not found"));
			}
			Singleton.get(opts.table + "/" + id, function (cb) {
				var instance = new Instance({
					data        : data[0],
					autoSave    : opts.autoSave,
					driver      : opts.driver,
					table       : opts.table,
					hooks       : opts.hooks,
					validations : opts.validations
				});
				OneAssociation.extend(instance, opts.driver, one_associations, {
					autoFetch : opts.autoFetch
				}, function () {
					return cb(instance);
				});
			}, function (instance) {
				return cb(null, instance);
			});
		});

		return this;
	};

	model.find = function () {
		var conditions = {};
		var cb         = null;
		var limit      = null;
		var order      = null;

		for (var i = 0; i < arguments.length; i++) {
			switch (typeof arguments[i]) {
				case "number":
					limit = arguments[i];
					break;
				case "object":
					if (Array.isArray(arguments[i])) {
						if (order.length > 0) {
							order = arguments[i];
						}
					} else {
						conditions = arguments[i];
					}
					break;
				case "function":
					cb = arguments[i];
					break;
				case "string":
					order = [ arguments[i] ];
					break;
			}
		}

		if (cb === null) {
			throw new Error("Missing Model.find callback");
		}

		opts.driver.find(opts.table, conditions, limit, order, function (err, data) {
			if (err) {
				return cb(err);
			}
			if (data.length === 0) {
				return cb(null, []);
			}
			var pending = data.length;
			for (var i = 0; i < data.length; i++) {
				(function (i) {
					Singleton.get(opts.table + "/" + data[i][opts.id], function (cb) {
						var instance = new Instance({
							data        : data[i],
							autoSave    : opts.autoSave,
							driver      : opts.driver,
							table       : opts.table,
							hooks       : opts.hooks,
							validations : opts.validations
						});
						OneAssociation.extend(instance, opts.driver, one_associations, {
							autoFetch : opts.autoFetch
						}, function () {
							return cb(instance);
						});
					}, function (instance) {
						data[i] = instance;

						pending -= 1;

						if (pending === 0) {
							return cb(null, data);
						}
					});
				})(i);
			}
		});

		return this;
	};

	model.clear = function (cb) {
		opts.driver.clear(opts.table, function (err) {
			if (typeof cb == "function") cb(err);
		});

		return this;
	};

	Object.defineProperty(model, "table", {
		value: opts.table,
		enumerable: false
	});
	Object.defineProperty(model, "id", {
		value: opts.id,
		enumerable: false
	});

	return model;
}