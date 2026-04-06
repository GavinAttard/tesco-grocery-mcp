import type { GraphQLOperation } from "./types.js";

// ─── Captured Queries (from browser traffic) ────────────────────────────────

const capturedQueries: Record<string, string> = {
  Search: `query Search($query: String!, $page: Int = 1, $count: Int, $sortBy: String, $offset: Int, $facet: ID, $favourites: Boolean, $filterCriteria: [filterCriteria], $configs: [ConfigArgType], $includeRestrictions: Boolean = true, $includeVariations: Boolean = true, $config: BrowseSearchConfig, $showDepositReturnCharge: Boolean = false, $showPopularFilter: Boolean = true, $appliedFacetArgs: [AppliedFacetArgs], $showExpandedResults: Boolean = false, $includeRangeFilter: Boolean = false, $showSuggestedSearch: Boolean = false, $suggestionsMaxTimeOut: Int, $includeAdditionalInfo: Boolean = false, $includeIsInAnyList: Boolean = false) {
  search(
    query: $query
    page: $page
    count: $count
    sortBy: $sortBy
    offset: $offset
    facet: $facet
    favourites: $favourites
    filterCriteria: $filterCriteria
    configs: $configs
    config: $config
    appliedFacetArgs: $appliedFacetArgs
  ) {
    pageInformation: info {
      ...PageInformation
      __typename
    }
    suggestions @include(if: $showSuggestedSearch) @maxTime(ms: $suggestionsMaxTimeOut) {
      searchTerms {
        suggestionQuery
        __typename
      }
      __typename
    }
    results {
      node {
        ... on MPProduct {
          ...ProductItem
          __typename
        }
        ... on FNFProduct {
          ...ProductItem
          __typename
        }
        ... on ProductType {
          ...ProductItem
          __typename
        }
        __typename
      }
      __typename
    }
    expandedResults @include(if: $showExpandedResults) {
      node {
        ... on MPProduct {
          ...ProductItem
          __typename
        }
        ... on FNFProduct {
          ...ProductItem
          __typename
        }
        ... on ProductType {
          ...ProductItem
          __typename
        }
        __typename
      }
      __typename
    }
    facetLists: facetGroups {
      ...FacetLists
      __typename
    }
    popularFilters: popFilters @include(if: $showPopularFilter) {
      ...PopFilters
      __typename
    }
    facets {
      ...facet
      __typename
    }
    options {
      sortBy
      __typename
    }
    additionalInfo @include(if: $includeAdditionalInfo) {
      __typename
      propositions {
        count
        name
        __typename
      }
    }
    __typename
  }
}

fragment ProductItem on ProductInterface {
  typename: __typename
  ... on ProductType {
    context {
      type
      ... on ProductContextOfferType {
        linkTo
        offerType
        __typename
      }
      __typename
    }
    __typename
  }
  sellers(type: TOP, limit: 1, offset: 0) {
    ...Sellers
    __typename
  }
  ... on MPProduct {
    context {
      type
      ... on ProductContextOfferType {
        linkTo
        offerType
        __typename
      }
      __typename
    }
    seller {
      id
      name
      __typename
    }
    variations {
      ...Variation @include(if: $includeVariations)
      __typename
    }
    __typename
  }
  ... on FNFProduct {
    context {
      type
      ... on ProductContextOfferType {
        linkTo
        offerType
        __typename
      }
      __typename
    }
    variations {
      priceRange {
        minPrice
        maxPrice
        __typename
      }
      ...Variation @include(if: $includeVariations)
      __typename
    }
    media {
      defaultImage {
        url
        aspectRatio
        __typename
      }
      images {
        url
        aspectRatio
        __typename
      }
      __typename
    }
    __typename
  }
  id
  tpnb
  tpnc
  gtin
  adId
  baseProductId
  title
  brandName
  shortDescription
  defaultImageUrl
  superDepartmentId
  media {
    defaultImage {
      url
      aspectRatio
      __typename
    }
    __typename
  }
  images {
    display {
      default {
        url
        __typename
      }
      __typename
    }
    __typename
  }
  quantityInBasket
  superDepartmentName
  departmentId
  departmentName
  aisleId
  aisleName
  shelfId
  shelfName
  displayType
  productType
  charges @include(if: $showDepositReturnCharge) {
    ... on ProductDepositReturnCharge {
      __typename
      amount
    }
    __typename
  }
  averageWeight
  bulkBuyLimit
  maxQuantityAllowed: bulkBuyLimit
  groupBulkBuyLimit
  bulkBuyLimitMessage
  bulkBuyLimitGroupId
  timeRestrictedDelivery
  restrictedDelivery
  isInFavourites
  isInAnyList @include(if: $includeIsInAnyList)
  isNew
  isRestrictedOrderAmendment
  maxWeight
  minWeight
  increment
  details {
    components {
      ...Competitors
      ...AdditionalInfo
      __typename
    }
    __typename
  }
  catchWeightList {
    price
    weight
    default
    __typename
  }
  restrictions @include(if: $includeRestrictions) {
    type
    isViolated
    message
    __typename
  }
  reviews {
    stats {
      noOfReviews
      overallRating
      overallRatingRange
      __typename
    }
    __typename
  }
  modelMetadata {
    name
    version
    __typename
  }
}

fragment Competitors on CompetitorsInfo {
  competitors {
    id
    priceMatch {
      isMatching
      __typename
    }
    __typename
  }
  __typename
}

fragment AdditionalInfo on AdditionalInfo {
  isLowEverydayPricing
  __typename
}

fragment Variation on VariationsType {
  products {
    id
    baseProductId
    variationAttributes {
      attributeGroup
      attributeGroupData {
        name
        value
        attributes {
          name
          value
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
  __typename
}

fragment Sellers on ProductSellers {
  __typename
  results {
    id
    __typename
    isForSale
    status
    seller {
      id
      name
      logo {
        url
        __typename
      }
      __typename
    }
    price {
      price: actual
      unitPrice
      unitOfMeasure
      actual
      __typename
    }
    promotions {
      id
      promotionType
      startDate
      endDate
      description
      unitSellingInfo
      price {
        beforeDiscount
        afterDiscount
        __typename
      }
      attributes
      __typename
    }
    fulfilment(deliveryOptions: BEST) {
      __typename
      ... on ProductDeliveryType {
        end
        charges {
          value
          __typename
        }
        __typename
      }
    }
  }
}

fragment FacetLists on ProductListFacetsType {
  __typename
  category
  categoryId
  facets {
    facetId: id
    facetName: name
    binCount: count
    isSelected: selected
    __typename
  }
}

fragment PageInformation on ListInfoType {
  totalCount: total
  pageNo: page
  pageId
  count
  pageSize
  matchType
  offset
  query {
    searchTerm
    actualTerm
    queryPhase
    __typename
  }
  __typename
}

fragment PopFilters on ProductListFacetsType {
  category
  categoryId
  facets {
    facetId: id
    facetName: name
    binCount: count
    isSelected: selected
    __typename
  }
  __typename
}

fragment facet on FacetInterface {
  __typename
  id
  name
  type
  ...FacetListTypeFields
  ...FacetMultiLevelTypeFields
  ...FacetRangeTypeFields @include(if: $includeRangeFilter)
  ...FacetBooleanTypeFields
}

fragment FacetListTypeFields on FacetListType {
  id
  name
  listValues: values {
    name
    value
    isSelected
    count
    __typename
  }
  multiplicity
  metadata {
    description
    footerText
    linkText
    linkUrl
    __typename
  }
  __typename
}

fragment FacetMultiLevelTypeFields on FacetMultiLevelType {
  id
  name
  multiLevelValues: values {
    children {
      count
      name
      value
      isSelected
      __typename
    }
    appliedValues {
      isSelected
      name
      value
      __typename
    }
    __typename
  }
  multiplicity
  metadata {
    description
    footerText
    linkText
    linkUrl
    __typename
  }
  __typename
}

fragment FacetRangeTypeFields on FacetRangeType {
  rangeValues: values {
    buckets {
      name
      value
      count
      isSelected
      __typename
    }
    customInput {
      min
      max
      appliedMin
      appliedMax
      step
      unit
      delimiter
      unitPosition
      __typename
    }
    __typename
  }
  __typename
}

fragment FacetBooleanTypeFields on FacetBooleanType {
  booleanValues: values {
    count
    isSelected
    value
    name
    __typename
  }
  __typename
}
`,
  GetBasket: `query GetBasket {
  basket {
    id
    locationUuid
    isInAmend
    amendOrderId
    shoppingMethod
    items {
      id
      unit
      weight
      quantity
      groupBulkBuyLimitReached
      cost
      bulkBuyLimitReached
      groupBulkBuyQuantity
      isNewlyAdded
      originalQuantity
      originalWeight
      product {
        id
        baseProductId
        bulkBuyLimitGroupId
        productType
        bulkBuyLimit
        groupBulkBuyLimit
        status
        isForSale
        isRestrictedOrderAmendment
        ... on MPProduct {
          seller {
            id
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    slot {
      id
      start
      end
      status
      charge
      __typename
    }
    localisation {
      currency {
        iso
        __typename
      }
      __typename
    }
    __typename
  }
}
`,
  GetRecommendations: `query GetRecommendations($exclusionInfo: ExclusionInfoType, $pageId: String, $pageName: TescoRecommendationpageName, $storeId: ID, $tpnc: ID, $provider: RecommendationProvider, $pageSize: Int, $variant: ID, $position: Int, $tpnb: ID, $includeRestrictions: Boolean = true, $includeVariations: Boolean = false, $showDepositReturnCharge: Boolean = false, $includeExecutionConfig: Boolean = false, $configs: [ConfigArgType], $minCount: Int, $includeIsInAnyList: Boolean = false) {
  recommendations(
    count: $pageSize
    exclusionInfo: $exclusionInfo
    pageId: $pageId
    pageName: $pageName
    provider: $provider
    storeId: $storeId
    position: $position
    tpnc: $tpnc
    variant: $variant
    tpnb: $tpnb
    configs: $configs
    minCount: $minCount
  ) {
    productItems: products {
      ...ProductItem
      __typename
    }
    pageInformation: info {
      ...PageInformation
      title
      __typename
    }
    config @include(if: $includeExecutionConfig) {
      executionDetail
      strategy
      fallbackStrategy
      variant
      __typename
    }
    __typename
  }
}

fragment PageInformation on ListInfoType {
  totalCount: total
  pageNo: page
  pageId
  count
  pageSize
  matchType
  offset
  query {
    searchTerm
    actualTerm
    queryPhase
    __typename
  }
  __typename
}

fragment ProductItem on ProductInterface {
  typename: __typename
  ... on ProductType {
    context {
      type
      ... on ProductContextOfferType {
        linkTo
        offerType
        __typename
      }
      __typename
    }
    __typename
  }
  sellers(type: TOP, limit: 1, offset: 0) {
    ...Sellers
    __typename
  }
  ... on MPProduct {
    context {
      type
      ... on ProductContextOfferType {
        linkTo
        offerType
        __typename
      }
      __typename
    }
    seller {
      id
      name
      __typename
    }
    variations {
      ...Variation @include(if: $includeVariations)
      __typename
    }
    __typename
  }
  ... on FNFProduct {
    context {
      type
      ... on ProductContextOfferType {
        linkTo
        offerType
        __typename
      }
      __typename
    }
    variations {
      priceRange {
        minPrice
        maxPrice
        __typename
      }
      ...Variation @include(if: $includeVariations)
      __typename
    }
    media {
      defaultImage {
        url
        aspectRatio
        __typename
      }
      images {
        url
        aspectRatio
        __typename
      }
      __typename
    }
    __typename
  }
  id
  tpnb
  tpnc
  gtin
  adId
  baseProductId
  title
  brandName
  shortDescription
  defaultImageUrl
  superDepartmentId
  media {
    defaultImage {
      url
      aspectRatio
      __typename
    }
    __typename
  }
  images {
    display {
      default {
        url
        __typename
      }
      __typename
    }
    __typename
  }
  quantityInBasket
  superDepartmentName
  departmentId
  departmentName
  aisleId
  aisleName
  shelfId
  shelfName
  displayType
  productType
  charges @include(if: $showDepositReturnCharge) {
    ... on ProductDepositReturnCharge {
      __typename
      amount
    }
    __typename
  }
  averageWeight
  bulkBuyLimit
  maxQuantityAllowed: bulkBuyLimit
  groupBulkBuyLimit
  bulkBuyLimitMessage
  bulkBuyLimitGroupId
  timeRestrictedDelivery
  restrictedDelivery
  isInFavourites
  isInAnyList @include(if: $includeIsInAnyList)
  isNew
  isRestrictedOrderAmendment
  maxWeight
  minWeight
  increment
  details {
    components {
      ...Competitors
      ...AdditionalInfo
      __typename
    }
    __typename
  }
  catchWeightList {
    price
    weight
    default
    __typename
  }
  restrictions @include(if: $includeRestrictions) {
    type
    isViolated
    message
    __typename
  }
  reviews {
    stats {
      noOfReviews
      overallRating
      overallRatingRange
      __typename
    }
    __typename
  }
  modelMetadata {
    name
    version
    __typename
  }
}

fragment Competitors on CompetitorsInfo {
  competitors {
    id
    priceMatch {
      isMatching
      __typename
    }
    __typename
  }
  __typename
}

fragment AdditionalInfo on AdditionalInfo {
  isLowEverydayPricing
  __typename
}

fragment Variation on VariationsType {
  products {
    id
    baseProductId
    variationAttributes {
      attributeGroup
      attributeGroupData {
        name
        value
        attributes {
          name
          value
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
  __typename
}

fragment Sellers on ProductSellers {
  __typename
  results {
    id
    __typename
    isForSale
    status
    seller {
      id
      name
      logo {
        url
        __typename
      }
      __typename
    }
    price {
      price: actual
      unitPrice
      unitOfMeasure
      actual
      __typename
    }
    promotions {
      id
      promotionType
      startDate
      endDate
      description
      unitSellingInfo
      price {
        beforeDiscount
        afterDiscount
        __typename
      }
      attributes
      __typename
    }
    fulfilment(deliveryOptions: BEST) {
      __typename
      ... on ProductDeliveryType {
        end
        charges {
          value
          __typename
        }
        __typename
      }
    }
  }
}
`,
  UpdateBasket: `mutation UpdateBasket($items: [BasketLineItemInputType], $orderId: ID) {
  basket(items: $items, orderId: $orderId) {
    id
    splitView {
      __typename
      id
      items {
        __typename
        id
        unit
        weight
        cost
        quantity
        originalQuantity
        groupBulkBuyLimitReached
        bulkBuyLimitReached
        groupBulkBuyQuantity
        originalWeight
        product {
          id
          seller {
            id
            __typename
          }
          __typename
        }
      }
    }
    items {
      __typename
      id
      unit
      weight
      cost
      quantity
      originalQuantity
      groupBulkBuyLimitReached
      bulkBuyLimitReached
      groupBulkBuyQuantity
      isNewlyAdded
      originalWeight
      product {
        id
        seller {
          id
          __typename
        }
        __typename
      }
    }
    updates {
      items {
        id
        successful
        __typename
      }
      __typename
    }
    __typename
  }
}
`,
  AnalyticsSellerIds: `query AnalyticsSellerIds {
  basket {
    id
    splitView {
      id
      items {
        id
        product {
          id
          gtin
          seller {
            id
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}
`,
  GetProfile: `query GetProfile {
  profile {
    firstName
    locationUuid
    isFirstTimeShopper
    __typename
  }
}
`,
  Taxonomy: `query Taxonomy($storeId: ID, $includeInspirationEvents: Boolean, $includeChildren: Boolean = true, $deliveryType: DeliveryTypeEnum, $configs: [ConfigArgType], $usePageType: Boolean = false) {
  taxonomy(
    storeId: $storeId
    includeInspirationEvents: $includeInspirationEvents
    deliveryType: $deliveryType
    configs: $configs
  ) {
    name
    label
    source
    pageType @include(if: $usePageType)
    children @include(if: $includeChildren) {
      name
      label
      source
      pageType @include(if: $usePageType)
      children {
        id
        label
        name
        source
        pageType @include(if: $usePageType)
        __typename
      }
      __typename
    }
    __typename
  }
}
`,
  GetFulfilmentOptions: `query GetFulfilmentOptions {
  fulfilmentOptions {
    fulfilmentMethods {
      type
      variants {
        __typename
        ... on ImmediateDeliveryType {
          id
          fulfilmentEstimatedArrival {
            time {
              range {
                min
                max
                __typename
              }
              __typename
            }
            __typename
          }
          __typename
        }
      }
      __typename
    }
    __typename
  }
}
`,
  GetProfileSavables: `query GetProfileSavables($durationInMonths: [Int!]) {
  profile {
    firstName
    savable(durationInMonths: $durationInMonths) {
      potentialSavings {
        businessProposition
        details {
          orders
          savableAmount
          currency
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}
`,
  GetFulfilment: `query GetFulfilment($type: FulfilmentTypeType) {
  fulfilment(type: $type) {
    metadata {
      availableWeeks {
        weekNo
        startDate
        endDate
        __typename
      }
      __typename
    }
    __typename
  }
}
`,
  GetPage: `query GetPage($pageName: String, $preview: Boolean, $dfpReportingRequired: Boolean, $customerContent: CustomerContentInputType) {
  page(
    pageName: $pageName
    preview: $preview
    dfpReportingRequired: $dfpReportingRequired
    customerContent: $customerContent
  ) {
    ...Page
    __typename
  }
}

fragment Page on DCSPage {
  pageName
  pageTitle
  keyword
  description
  canonicalUrl
  children {
    type
    props
    children {
      type
      props
      children {
        type
        props
        __typename
      }
      __typename
    }
    __typename
  }
  __typename
}
`,
  GetDeliverySlotGroups: `query GetDeliverySlotGroups {
  deliverySlotGroups
}
`,
  DeliverySlots: `query DeliverySlots($start: String, $end: String, $group: Int, $type: FulfilmentTypeType) {
  delivery(start: $start, end: $end, group: $group) {
    ...Slot
    __typename
  }
  fulfilment(type: $type, range: {start: $start, end: $end}) {
    ...Fulfilment
    __typename
  }
}

fragment Slot on SlotInterface {
  id
  start
  end
  charge
  status
  group
  price {
    beforeDiscount
    afterDiscount
    __typename
  }
  locationUuid
  __typename
}

fragment Fulfilment on FulfilmentType {
  metadata {
    preBookedOrderDays
    __typename
  }
  __typename
}
`,
  GetSubscriptions: `query GetSubscriptions {
  profile {
    subscriptions {
      subscriptionType
      subscriptionStatus
      schemeId
      saving {
        totalAmount
        totalOrders
        __typename
      }
      previousRenewalDate
      startDate
      __typename
    }
    __typename
  }
}
`,
  Fulfilment: `mutation Fulfilment($slotId: ID, $action: SlotActions) {
  fulfilment(slotId: $slotId, action: $action) {
    slot {
      id
      status
      start
      end
      reservationExpiry
      group
      locationUuid
      __typename
    }
    __typename
  }
}
`,
  Page: `query Page($pageName: String!, $preview: Boolean, $configs: [ConfigArgType], $targetingParams: String, $dfpReportingRequired: Boolean, $isReporting: Boolean) {
  page(
    pageName: $pageName
    preview: $preview
    configs: $configs
    targetingParams: $targetingParams
    dfpReportingRequired: $dfpReportingRequired
    isReporting: $isReporting
    populateTargetingParams: true
  ) @maxTime(ms: 900) {
    children {
      type
      props
      childrenType
      children {
        type
        props
        __typename
      }
      __typename
    }
    __typename
  }
}
`,
};

// ─── Hand-Written Queries ───────────────────────────────────────────────────

const handWrittenQueries: Record<string, string> = {
  GetFavouritesCarousel: `query GetFavouritesCarousel { favourites { products { id tpnb title brandName defaultImageUrl superDepartmentName departmentName aisleName shelfName displayType productType isInFavourites isNew status sellers(type: TOP, limit: 1, offset: 0) { results { id isForSale status price { price: actual unitPrice unitOfMeasure __typename } promotions { id promotionType startDate endDate description unitSellingInfo price { beforeDiscount afterDiscount __typename } attributes __typename } __typename } __typename } reviews { stats { noOfReviews overallRating __typename } __typename } __typename } __typename } }`,
  GetAllOrders: `query GetAllOrders { orders {
    id
    status
    shoppingMethod
    orderId
    locationUuid
    slot { id start end charge status __typename }
    items { id quantity unit weight cost __typename }
    __typename
  } }`,
};

// ─── Query Lookup ───────────────────────────────────────────────────────────

/**
 * Get a GraphQL query string by operation name.
 * Checks captured queries first, then hand-written.
 */
export function getQuery(operationName: string): string {
  const query =
    capturedQueries[operationName] ?? handWrittenQueries[operationName];
  if (!query) {
    const available = [
      ...Object.keys(capturedQueries),
      ...Object.keys(handWrittenQueries),
    ];
    throw new Error(
      `No query for "${operationName}". Available: ${available.join(", ")}`,
    );
  }
  return query;
}

/**
 * Build a complete GraphQL operation envelope.
 */
export function buildOperation(
  operationName: string,
  variables: Record<string, unknown> = {},
  mfeName = "unknown",
): GraphQLOperation {
  return {
    operationName,
    variables,
    extensions: { mfeName },
    query: getQuery(operationName),
  };
}
