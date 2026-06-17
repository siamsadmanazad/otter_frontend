export const getInitials = (name: string): string => {
    const parts = name.split(' ').filter(part => part.length > 0);
  
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
  
    if (parts.length >= 2) {
      const firstInitial = parts[0].charAt(0);
      const lastInitial = parts[parts.length - 1].charAt(0);
      return `${firstInitial}${lastInitial}`.toUpperCase();
    }
  
    return '';
  };