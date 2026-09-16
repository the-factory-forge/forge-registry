export interface PrivacySection {
  title: string;
  content: string;
}

export type PrivacyLocale = "fr" | "en" | "de" | "it";

export const PRIVACY_UPDATED_AT = "2026-07-31";

/**
 * Reference legal content for the privacy policy page (Swiss nLPD/FADP).
 * The Corner Factory SA reviews and updates this content once here;
 * site dictionaries are kept in sync from this source of truth.
 *
 * Placeholders per site (replace with client data):
 *   - {businessName}, {address}, {email}
 */
export const PRIVACY_SECTIONS: Record<PrivacyLocale, PrivacySection[]> = {
  fr: [
    {
      title: "Responsable du traitement",
      content: "{businessName}\n{address}\nSuisse\nEmail : {email}",
    },
    {
      title: "Données collectées",
      content:
        "Nous collectons uniquement les données nécessaires au bon fonctionnement du site et, avec votre consentement, des statistiques d'utilisation via Google Analytics (Google LLC, USA).",
    },
    {
      title: "Finalités",
      content:
        "Vos données sont utilisées pour faire fonctionner le site, répondre à vos demandes de contact et de rendez-vous, et améliorer nos services. Les finalités marketing ne sont poursuivies qu'avec un consentement séparé.",
    },
    {
      title: "Cookies et suivi",
      content:
        "Ce site utilise Google Analytics (GA4) pour mesurer l'audience. Ces cookies ne sont activés qu'après votre consentement explicite. Vous pouvez modifier vos préférences à tout moment via le lien « Gestion des cookies » dans le pied de page. Les données collectées par Google Analytics peuvent être transférées et traitées aux États-Unis.",
    },
    {
      title: "Durée de conservation",
      content:
        "Les données Google Analytics sont automatiquement supprimées par Google après 14 mois (durée de conservation par défaut de Google Analytics). Les données de contact (email, téléphone) sont conservées pendant la durée de notre relation commerciale et, à titre de registre de contacts, aussi longtemps que l'entreprise existe. Vous pouvez demander leur suppression à tout moment.",
    },
    {
      title: "Vos droits",
      content:
        "Vous disposez d'un droit d'accès, de modification, de suppression et de portabilité de vos données personnelles, ainsi que du droit de retirer votre consentement à tout moment. Pour exercer ces droits, veuillez nous contacter par email. Les données de navigation agrégées (Google Analytics) ne permettent pas d'identifier une personne individuelle.",
    },
  ],
  en: [
    {
      title: "Data controller",
      content: "{businessName}\n{address}\nSwitzerland\nEmail: {email}",
    },
    {
      title: "Data collected",
      content:
        "We only collect data necessary for the proper functioning of the site and, with your consent, usage statistics via Google Analytics (Google LLC, USA).",
    },
    {
      title: "Purposes",
      content:
        "Your data is used to operate the website, respond to your contact and booking requests, and improve our services. Marketing purposes are only pursued with separate consent.",
    },
    {
      title: "Cookies and tracking",
      content:
        'This site uses Google Analytics (GA4) to measure audience. These cookies are only activated after your explicit consent. You can change your preferences at any time using the "Cookie settings" link in the footer. Data collected by Google Analytics may be transferred to and processed in the United States.',
    },
    {
      title: "Data retention",
      content:
        "Google Analytics data is automatically deleted by Google after 14 months (default retention period of Google Analytics). Contact data (email, phone) is kept for the duration of our business relationship and, as a contact register, for as long as the company exists. You can request its deletion at any time.",
    },
    {
      title: "Your rights",
      content:
        "You have the right to access, modify, delete, and port your personal data, as well as the right to withdraw your consent at any time. To exercise these rights, please contact us by email. Aggregated browsing data (Google Analytics) does not allow identifying an individual person.",
    },
  ],
  de: [
    {
      title: "Verantwortlicher",
      content: "{businessName}\n{address}\nSchweiz\nE-Mail: {email}",
    },
    {
      title: "Datenerhebung",
      content:
        "Wir erheben nur Daten, die für den Betrieb der Website erforderlich sind, und mit Ihrer Einwilligung Nutzungsstatistiken über Google Analytics (Google LLC, USA).",
    },
    {
      title: "Zwecke",
      content:
        "Ihre Daten werden verwendet, um die Website zu betreiben, Ihre Kontakt- und Terminanfragen zu beantworten und unsere Dienstleistungen zu verbessern. Marketingzwecke werden nur mit separater Einwilligung verfolgt.",
    },
    {
      title: "Cookies und Tracking",
      content:
        "Diese Website verwendet Google Analytics (GA4) zur Reichweitenmessung. Diese Cookies werden nur nach Ihrer ausdrücklichen Einwilligung aktiviert. Sie können Ihre Einstellungen jederzeit über den Link « Cookie-Einstellungen » in der Fusszeile ändern. Die von Google Analytics erfassten Daten können in die USA übertragen und dort verarbeitet werden.",
    },
    {
      title: "Aufbewahrungsdauer",
      content:
        "Google-Analytics-Daten werden von Google nach 14 Monaten automatisch gelöscht (Standard-Aufbewahrungsfrist von Google Analytics). Kontaktdaten (E-Mail, Telefon) werden während der Dauer unserer Geschäftsbeziehung und als Kontaktregister so lange aufbewahrt, wie das Unternehmen besteht. Sie können deren Löschung jederzeit verlangen.",
    },
    {
      title: "Ihre Rechte",
      content:
        "Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Übertragbarkeit Ihrer personenbezogenen Daten sowie das Recht, Ihre Einwilligung jederzeit zu widerrufen. Um diese Rechte auszuüben, kontaktieren Sie uns bitte per E-Mail. Aggregierte Navigationsdaten (Google Analytics) erlauben keine Identifizierung einer einzelnen Person.",
    },
  ],
  it: [
    {
      title: "Titolare del trattamento",
      content: "{businessName}\n{address}\nSvizzera\nEmail: {email}",
    },
    {
      title: "Dati raccolti",
      content:
        "Raccogliamo solo i dati necessari al funzionamento del sito e, con il vostro consenso, statistiche di utilizzo tramite Google Analytics (Google LLC, USA).",
    },
    {
      title: "Finalità",
      content:
        "I vostri dati vengono utilizzati per gestire il sito, rispondere alle vostre richieste di contatto e prenotazione e migliorare i nostri servizi. Le finalità di marketing sono perseguite solo con un consenso separato.",
    },
    {
      title: "Cookie e tracciamento",
      content:
        "Questo sito utilizza Google Analytics (GA4) per misurare l'audience. Questi cookie vengono attivati solo dopo il vostro consenso esplicito. Potete modificare le vostre preferenze in qualsiasi momento tramite il link « Gestione cookie » nel footer. I dati raccolti da Google Analytics possono essere trasferiti ed elaborati negli Stati Uniti.",
    },
    {
      title: "Durata di conservazione",
      content:
        "I dati di Google Analytics vengono eliminati automaticamente da Google dopo 14 mesi (periodo di conservazione predefinito di Google Analytics). I dati di contatto (email, telefono) vengono conservati per la durata del nostro rapporto commerciale e, come registro di contatti, per tutto il tempo di esistenza dell'azienda. Potete richiederne la cancellazione in qualsiasi momento.",
    },
    {
      title: "I vostri diritti",
      content:
        "Avete diritto di accesso, modifica, cancellazione e portabilità dei vostri dati personali, nonché il diritto di revocare il vostro consenso in qualsiasi momento. Per esercitare questi diritti, contattateci via email. I dati di navigazione aggregati (Google Analytics) non consentono di identificare una singola persona.",
    },
  ],
};
