const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email && emailRegex.test(email);
};

const isValidPhoneNumber = (phone) => {
    if (!phone) return false;
    // Basic validation for phone with country code
    const phoneRegex = /^\+\d{1,4}\d{6,14}$/;
    return phoneRegex.test(phone);
};

module.exports = {
    isValidEmail,
    isValidPhoneNumber
};
