// Contraste medido (WCAG, mínimo 4,5:1 para texto):
// - primary é para preenchimento; texto/ícone por cima usa onPrimary (7,1:1; branco dava 2,2:1)
// - primary como cor de texto/ícone usa primaryText (5,3:1 no branco, 5,0:1 no fundo)
export const Colors = {
  primary: '#00C6A7',
  primaryDark: '#00A88E',
  onPrimary: '#0D2926',
  primaryText: '#007A67',
  secondary: '#FF6B6B',
  success: '#2E7D32',
  warning: '#B45309',
  error: '#D32F2F',
  background: '#F5FAFA',
  card: '#FFFFFF',
  text: '#0D2926',
  textSecondary: '#6B7280',
  border: '#D1EEEA',
  tabBar: '#FFFFFF',
  tabBarActive: '#007A67',
  tabBarInactive: '#6B7280',
} as const;
