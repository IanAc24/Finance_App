// Throwaway prototype text, in Spanish only. It lives here (and not in the
// screens) so the translation tests, which scan every .jsx, stay green.
export const copy = {
  // switcher
  switcherLabel: 'Cambiar de propuesta',
  switcherHint: 'Flechas izquierda y derecha para cambiar',
  goHome: 'Ver inicio',
  goHistory: 'Ver historial',
  protoHome: 'Inicio',
  protoHistory: 'Historial',

  // shared
  hello: 'Hola',
  today: 'Hoy',
  yesterday: 'Ayer',
  expenseWord: 'Gasto',
  incomeWord: 'Ingreso',
  savingsWord: 'Ahorro',
  addExpense: 'Agregar gasto',
  addIncome: 'Agregar ingreso',
  confirm: 'Confirmar',
  skip: 'Omitir',
  done: 'Listo',
  recent: 'Últimos movimientos',
  dueTitle: 'Pagos de esta quincena',
  savingsTitle: 'Ahorros',
  savingsEmpty: 'Aún no tienes ahorros',
  seeAll: 'Ver todo el historial',
  noteFallbackIncome: 'Ingreso',
  noteFallbackExpense: 'Gasto',
  otherCategories: 'Otras categorías',
  uncategorized: 'Sin categoría',
  savedNotice: 'Listo, lo registramos.',
  skippedNotice: 'Sin problema, lo dejamos para la próxima.',
  moveNotice: 'Listo, ese sobrante ya está en tus ahorros.',
  leftoverNotNowNotice: 'Sin problema, no lo movimos.',
  saveError: 'No pudimos guardarlo. Inténtalo otra vez.',
  leftoverTitle: 'Te sobró de la quincena pasada',
  moveToSavings: 'Guardar en ahorros',
  notNow: 'Ahora no',

  // empty states
  emptyTitle: 'Bienvenido, aquí empieza todo',
  emptyText:
    'Todavía no hay movimientos. Anota tu primer gasto o ingreso y te mostramos cuánto puedes gastar cada día.',
  emptyFirstExpense: 'Agregar mi primer gasto',
  emptyQuincenaTitle: 'Esta quincena apenas empieza',
  emptyQuincenaText: 'Cuando anotes un ingreso o un gasto, aquí verás tu resumen.',
  emptyHistoryTitle: 'Tu historial está vacío',
  emptyHistoryText: 'Cada gasto o ingreso que anotes aparecerá aquí, ordenado por día.',
  emptyMonthText: 'No hay movimientos en este mes. Prueba con otro mes.',
  emptyFilterText: 'No hay movimientos de este tipo en este mes.',

  // Resumen
  canSpendToday: 'Puedes gastar hoy',
  leftThisQuincena: 'Te quedan',
  ofThisQuincena: 'de esta quincena',
  leftOnlyLabel: 'Te quedan en esta quincena',
  pendingExceeds: 'Tus pagos pendientes son más de lo que tienes ahora',
  waitingIncome: 'Esperando tu próximo ingreso',
  over: 'Ya gastaste todo lo de esta quincena',
  lastDay: 'último día',
  waitingPay: 'esperando tu pago',
  whereMoneyWent: 'En qué se fue tu dinero',
  nothingSpentYet: 'Todavía no has gastado nada esta quincena. ¡Muy bien!',
  otherCurrency: 'También tienes',
  spentLabel: 'Gastado',
  incomeLabel: 'Ingresos',
  withGoalNote: 'Ya separamos tu meta de ahorro',

  // Diario
  talkToday: 'Hoy puedes gastar',
  talkLeftOnly: 'Esta quincena te quedan',
  quickActions: 'Acciones rápidas',
  nothingToday: 'Todavía no hay movimientos hoy. Buen día para cuidar el bolsillo.',
  nothingYesterday: 'Ayer no anotaste nada.',
  budgetsTitle: 'Presupuestos',
  budgetsInvite: 'Crea un presupuesto para ver cuánto te queda por categoría.',
  budgetsLink: 'Crear presupuesto',
  filterAll: 'Todo',
  filterExpenses: 'Gastos',
  filterIncome: 'Ingresos',
  filterLabel: 'Filtrar por tipo',
  checklistDone: 'Hecho',
}

// "Día 8 de 16"
export const dayProgress = (n, total) => `Día ${n} de ${total}`

// "9 días" / "1 día"
export const daysText = (n) => (n === 1 ? 'último día' : `${n} días`)

// "Te quedan ₡174.900 de esta quincena · 9 días"
export const leftSentence = (amount, days) =>
  `Te quedan ${amount} de esta quincena · ${days}`

export const overBudget = (amount) => `Te pasaste por ${amount}`
export const budgetLeft = (amount) => `Te quedan ${amount}`
export const budgetOf = (spent, limit) => `${spent} de ${limit}`

// History header
export const monthLabel = {
  CRC: 'Colones',
  USD: 'Dólares',
}
export const currencyName = (code) => monthLabel[code] ?? code
export const prevMonth = 'Mes anterior'
export const nextMonth = 'Mes siguiente'
export const countWord = (n) => (n === 1 ? '1 movimiento' : `${n} movimientos`)
