import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Casa de Ração | Gestão',description:'Estoque, vendas e finanças da sua casa de ração.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>;}
