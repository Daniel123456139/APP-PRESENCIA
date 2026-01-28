
/**
 * Formats an employee ID for visual display (e.g. pads with zeros to 3 digits).
 * @param id The raw employee ID (number or string)
 * @returns The formatted string (e.g. "002")
 */
export const formatEmployeeId = (id: number | string): string => {
    return String(id).padStart(3, '0');
};
