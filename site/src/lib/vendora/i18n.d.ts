import type { Locale } from "./types";
/**
 * Centralized UI copy for the Vendora storefront implementation.
 * Persian copy is the design source of truth (Penpot); English mirrors it
 * for the /en locale. All new components must pull strings from here.
 */
declare const fa: {
    common: {
        viewAll: string;
        view: string;
        details: string;
        edit: string;
        delete: string;
        save: string;
        cancel: string;
        back: string;
        submit: string;
        searchLabel: string;
        home: string;
        account: string;
        close: string;
        menu: string;
        cart: string;
        wishlist: string;
        required: string;
        toman: string;
    };
    nav: {
        categories: string;
        bestSellers: string;
        officeBags: string;
        dailyBags: string;
        travel: string;
        journal: string;
        trackOrder: string;
        megaMenuTitle: string;
        viewAllProducts: string;
        mobileSearchPlaceholder: string;
        desktopSearchPlaceholder: string;
    };
    footer: {
        tagline: string;
        columns: {
            title: string;
            links: string[];
        }[];
        copyright: string;
        trust: string;
    };
    home: {
        heroBadge: string;
        heroTitle: string;
        heroBody: string;
        heroPrimary: string;
        heroSecondary: string;
        popularTitle: string;
        newestTitle: string;
        quickLinks: {
            title: string;
            subtitle: string;
            cta: string;
        }[];
        benefits: {
            title: string;
            body: string;
        }[];
        promos: {
            eyebrow: string;
            title: string;
            body: string;
            cta: string;
        }[];
        categoriesTitle: string;
        storyEyebrow: string;
        storyTitle: string;
        storyBody: string;
        storyCta: string;
        freeShippingBadge: string;
        addToCart: string;
    };
    account: {
        crumbRoot: string;
        menu: {
            overview: string;
            profile: string;
            security: string;
            addresses: string;
            orders: string;
            returns: string;
            transactions: string;
            wishlist: string;
            quickPay: string;
            logout: string;
        };
        memberSince: string;
        dashboard: {
            title: string;
            subtitle: string;
            greeting: string;
            intro: string;
            activeMember: string;
            editProfileLink: string;
            clubTitle: string;
            clubPointsSuffix: string;
            clubToNext: (points: string) => string;
            quickTitle: string;
            quickCards: {
                title: string;
                body: string;
                cta: string;
            }[];
            recentOrders: string;
            recentOrdersAll: string;
            supportTitle: string;
            supportBody: string;
            supportCta: string;
        };
        profile: {
            crumb: string;
            title: string;
            subtitle: string;
            sectionTitle: string;
            firstName: string;
            lastName: string;
            email: string;
            phone: string;
            privacyTitle: string;
            privacyBody: string;
            saved: string;
        };
        security: {
            crumb: string;
            title: string;
            subtitle: string;
            sectionTitle: string;
            oldPassword: string;
            newPassword: string;
            confirmPassword: string;
            strength: {
                label: string;
                weak: string;
                medium: string;
                strong: string;
            };
            guidanceTitle: string;
            guidanceBody: string;
            requirements: {
                length: string;
                lowercase: string;
                uppercase: string;
                digit: string;
                special: string;
            };
            classesUsed: (count: string) => string;
            classesWarning: string;
            currentRequired: string;
            newRequired: string;
            newTooShort: string;
            newClassesRequired: string;
            confirmRequired: string;
            currentInvalid: string;
            serverError: string;
            unauthorized: string;
            mismatch: string;
            updated: string;
        };
        addresses: {
            crumb: string;
            title: string;
            subtitle: string;
            add: string;
            defaultBadge: string;
            recipientPrefix: string;
            tipTitle: string;
            tipBody: string;
            tipLink: string;
            removed: string;
            emptyTitle: string;
            emptyBody: string;
            form: {
                crumbAdd: string;
                titleAdd: string;
                titleEdit: string;
                subtitle: string;
                sectionRecipient: string;
                sectionLocation: string;
                company: string;
                country: string;
                province: string;
                city: string;
                postalCode: string;
                addressLine: string;
                mapTitle: string;
                mapBody: string;
                mapCta: string;
                defaultSwitch: string;
                submit: string;
                saved: string;
            };
        };
        orders: {
            crumb: string;
            title: string;
            subtitle: string;
            searchPlaceholder: string;
            filters: {
                all: string;
                processing: string;
                shipped: string;
            };
            tableHead: {
                id: string;
                customer: string;
                count: string;
                status: string;
                total: string;
                date: string;
            };
            itemsSuffix: string;
            emptyFiltered: string;
            detail: {
                titlePrefix: string;
                placedPrefix: string;
                summaryTitle: string;
                statusLabel: string;
                paymentLabel: string;
                shippingLabel: string;
                countLabel: string;
                itemsTitle: string;
                addressTitle: string;
                totalsTitle: string;
                itemsSubtotal: string;
                shippingCost: string;
                freeShipping: string;
                grandTotal: string;
                invoice: string;
                requestReturn: string;
                support: string;
                steps: string[];
                qtySuffix: string;
            };
        };
        statusLabels: Record<string, string>;
        returns: {
            crumb: string;
            title: string;
            subtitle: string;
            newReturn: string;
            tabs: {
                all: string;
                review: string;
                approved: string;
                rejected: string;
            };
            searchLabel: string;
            searchPlaceholder: string;
            idLabel: string;
            itemLabel: string;
            reasonLabel: string;
            dateLabel: string;
            viewRequest: string;
            guideTitle: string;
            guideBody: string;
            guideCta: string;
            statusLabels: Record<string, string>;
            emptyFiltered: string;
            new: {
                crumb: string;
                title: string;
                subtitle: string;
                stepper: string[];
                contactSection: string;
                orderSection: string;
                reasonSection: string;
                evidenceSection: string;
                orderCodeLabel: string;
                orderDateLabel: string;
                productLabel: string;
                skuLabel: string;
                quantityLabel: string;
                reasons: string[];
                openedQuestion: string;
                yes: string;
                no: string;
                extraNotes: string;
                uploadTitle: string;
                uploadHint: string;
                captchaLabel: string;
                captchaPlaceholder: string;
                submit: string;
                cancel: string;
                privacyNote: string;
                successTitle: string;
                successBody: string;
                successCta: string;
            };
        };
        wishlist: {
            crumb: string;
            title: string;
            subtitle: string;
            toolbarCount: (n: string) => string;
            clear: string;
            addToCart: string;
            remove: string;
            addedToCart: string;
            emptyTitle: string;
            emptyBody: string;
            browseCta: string;
            recommendations: string;
        };
        transactions: {
            crumb: string;
            title: string;
            subtitle: string;
            balanceLabel: string;
            increaseBalance: string;
            balanceHint: string;
            tabs: {
                all: string;
                income: string;
                spend: string;
            };
            tableHead: {
                date: string;
                description: string;
                amount: string;
            };
            noteTitle: string;
            noteBody: string;
            emptyFiltered: string;
        };
        quickPay: {
            crumb: string;
            title: string;
            subtitle: string;
            payerTitle: string;
            payerName: string;
            payerMeta: string;
            formSection: string;
            amountLabel: string;
            amountPlaceholder: string;
            amountHint: string;
            methodLabel: string;
            methodOnline: string;
            methodOnlineHint: string;
            methodCredit: string;
            methodCreditHint: string;
            notesLabel: string;
            notesPlaceholder: string;
            captchaLabel: string;
            captchaPlaceholder: string;
            pay: string;
            trustTitle: string;
            trustBody: string;
            invalidAmount: string;
            resultPage: {
                successTitle: string;
                successBody: string;
                failedTitle: string;
                failedBody: string;
                pendingTitle: string;
                pendingBody: string;
                trackingLabel: string;
                viewTransactions: string;
                retry: string;
                backHome: string;
            };
        };
        emptyGeneric: {
            title: string;
            body: string;
        };
        productCard: {
            addToWishlist: string;
            removeFromWishlist: string;
            addToCart: string;
        };
    };
};
export type Dict = typeof fa;
/** Returns the dictionary for the given locale. */
export declare function getDict(locale: Locale): Dict;
export {};
