import React from 'react';

// FIX: This component was referencing a non-existent ThemeContext from App.tsx, causing build errors.
// As the theme feature is not implemented and this component is unused, it is stubbed to return null to resolve the errors.
const ThemeToggle: React.FC = () => {
    return null;
};

export default ThemeToggle;
