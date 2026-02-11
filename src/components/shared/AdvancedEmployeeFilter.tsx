import React, { useMemo } from 'react';
import { User } from '../../types';
import EmployeeMultiSelect from './EmployeeMultiSelect';
import { Operario } from '../../services/erpApi';

interface AdvancedEmployeeFilterProps {
    allEmployees: User[];
    selectedEmployeeIds: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
    visibleForSelectionEmployees?: User[];
}

const AdvancedEmployeeFilter: React.FC<AdvancedEmployeeFilterProps> = ({
    selectedEmployeeIds,
    onChange,
    disabled = false,
    visibleForSelectionEmployees,
    allEmployees
}) => {
    // Determine which employees to show
    const employeesToShow = visibleForSelectionEmployees || allEmployees;

    // Convert User[] to Operario[] for compatibility with EmployeeMultiSelect
    const options: Operario[] = useMemo(() => {
        return employeesToShow.map(u => ({
            IDOperario: u.id,
            DescOperario: u.name,
            IDDepartamento: 0, // Mock/Unknown as User type doesn't have it
            DescDepartamento: String(u.role), // Mapping role to Dept for display purposes if needed
            Activo: true, // Assuming active as they are in the list
            Productivo: true,
            Flexible: false
        }));
    }, [employeesToShow]);

    // Handle change: EmployeeMultiSelect returns string[] of IDs. This matches our prop.
    return (
        <EmployeeMultiSelect
            selectedIds={selectedEmployeeIds}
            onChange={onChange}
            disabled={disabled}
            options={options}
            includeInactive={true} // Options passed are already filtered by caller usually
            className="w-full"
            placeholder="Seleccionar empleados..."
        />
    );
};

export default AdvancedEmployeeFilter;
