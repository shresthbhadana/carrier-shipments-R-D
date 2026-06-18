const validate =
    (schema, source = "body") =>
        (req, res, next) => {

            const { error } = schema.validate(
                req[source],
                {
                    abortEarly: false
                }
            );

            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error.details.map(
                        (e) => e.message
                    )
                });
            }

            next();
        };

module.exports = validate;