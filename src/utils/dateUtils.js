const formatToIST = (dateString) => {
    if (!dateString) return null;

    try {
        const date = new Date(dateString);

        // Convert to IST (UTC+5:30)
        const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
        const istDate = new Date(date.getTime() + istOffset);

        // Return ISO-8601 format
        return istDate.toISOString();
    } catch (error) {
        console.error('Error formatting date:', error);
        return null;
    }
};

const getCurrentIST = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString();
};

module.exports = {
    formatToIST,
    getCurrentIST
};
