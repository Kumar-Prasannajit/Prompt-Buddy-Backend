const asyncHandler = (incomingRequestHandler) => {
    return async (req, res, next) => {
        Promise
            .resolve(incomingRequestHandler(req, res, next))
            .catch((error) => {
                next(error)
            })
    }
}

export { asyncHandler }