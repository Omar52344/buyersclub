import { formatMoney } from '@buyersclub/core';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../lib/api';
import {
  createBranch,
  createBusiness,
  createProduct,
  getCategories,
  getMyBusinesses,
  getProducts,
  setBranchHours,
  setBranchOpen,
  type BranchSummary,
  type Business,
  type Category,
  type CurrencyCode,
  type Product,
} from '../lib/vendor';
import { colors, radius, spacing } from '../theme';

const CURRENCIES: CurrencyCode[] = ['COP', 'USD'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'No pudimos conectar con el servidor. Intenta de nuevo.';
}

function parseMajor(value: string): number | null {
  const normalized = value.replace(/[^\d.]/g, '');
  if (!normalized) {
    return null;
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function money(cents: number, currency: CurrencyCode): string {
  return formatMoney({ amountCents: cents, currency });
}

export default function VendorScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [businessName, setBusinessName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('COP');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState('3000');
  const [minOrder, setMinOrder] = useState('10000');
  const [prepTime, setPrepTime] = useState('20');
  const [opensAt, setOpensAt] = useState('08:00');
  const [closesAt, setClosesAt] = useState('18:00');
  const [openSunday, setOpenSunday] = useState(false);

  const [showProductForm, setShowProductForm] = useState(false);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [price, setPrice] = useState('');
  const [shareAll, setShareAll] = useState(true);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  const business = businesses[0] ?? null;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [categoryList, businessList] = await Promise.all([
          getCategories(),
          getMyBusinesses(),
        ]);
        if (!active) {
          return;
        }
        setCategories(categoryList);
        setBusinesses(businessList);
        setCurrency(businessList[0]?.currency ?? 'COP');
        if (businessList[0]) {
          setProducts(await getProducts(businessList[0].id));
        }
      } catch (caught) {
        if (active) {
          setError(messageOf(caught));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function reload() {
    const list = await getMyBusinesses();
    setBusinesses(list);
    if (list[0]) {
      setProducts(await getProducts(list[0].id));
    } else {
      setProducts([]);
    }
    return list;
  }

  async function handleCreateBusiness() {
    setError(null);
    setInfo(null);
    if (businessName.trim().length < 2) {
      setError('Escribe el nombre de tu empresa.');
      return;
    }

    setBusy(true);
    try {
      await createBusiness({
        name: businessName.trim(),
        description: businessDescription.trim() || undefined,
        categoryId: categoryId ?? undefined,
        currency,
      });
      await reload();
      setBusinessName('');
      setBusinessDescription('');
      setCategoryId(null);
      setInfo('Empresa creada. Ahora agrega tu primera sucursal.');
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function useMyLocation() {
    setError(null);
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('No diste permiso de ubicación. Escribe la dirección y la ubicaremos nosotros.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      setInfo('Ubicación capturada para esta sucursal.');
    } catch {
      setError('No pudimos obtener tu ubicación.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateBranch() {
    if (!business) {
      return;
    }
    setError(null);
    setInfo(null);
    if (branchName.trim().length < 2 || addressLine.trim().length < 5 || city.trim().length < 2) {
      setError('Completa nombre, dirección y ciudad de la sucursal.');
      return;
    }
    if (!TIME_PATTERN.test(opensAt) || !TIME_PATTERN.test(closesAt)) {
      setError('Usa horarios en formato HH:MM, por ejemplo 08:00.');
      return;
    }

    const feeCents = parseMajor(deliveryFee) ?? 0;
    const minOrderCents = parseMajor(minOrder) ?? 0;
    const prep = Number(prepTime);
    if (!Number.isInteger(prep) || prep < 0 || prep > 240) {
      setError('El tiempo de preparación debe estar entre 0 y 240 minutos.');
      return;
    }

    setBusy(true);
    try {
      const branch = await createBranch(business.id, {
        name: branchName.trim(),
        addressLine: addressLine.trim(),
        city: city.trim(),
        phone: branchPhone.trim() || undefined,
        lat: coords?.lat,
        lng: coords?.lng,
        deliveryEnabled,
        pickupEnabled,
        deliveryFeeCents: feeCents,
        minOrderCents,
        prepTimeMinutes: prep,
        deliveryEtaMinutes: 20,
      });

      const weekdays = [1, 2, 3, 4, 5, 6];
      const ranges = weekdays.map((weekday) => ({
        weekday,
        opensAt,
        closesAt,
      }));
      if (openSunday) {
        ranges.push({ weekday: 0, opensAt, closesAt });
      }
      await setBranchHours(branch.id, ranges);

      await reload();
      setBranchName('');
      setAddressLine('');
      setCity('');
      setBranchPhone('');
      setCoords(null);
      setShowBranchForm(false);
      setInfo('Sucursal creada con su horario. Los productos compartidos se asignaron solos.');
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleOpen(branch: BranchSummary, value: boolean) {
    setError(null);
    setBusy(true);
    try {
      await setBranchOpen(branch.id, value);
      await reload();
      setInfo(value ? 'Sucursal marcada como abierta.' : 'Sucursal marcada como cerrada.');
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateProduct() {
    if (!business) {
      return;
    }
    setError(null);
    setInfo(null);
    if (productName.trim().length < 2) {
      setError('Escribe el nombre del producto.');
      return;
    }
    const priceCents = parseMajor(price);
    if (priceCents === null || priceCents <= 0) {
      setError('Escribe un precio mayor a cero.');
      return;
    }
    if (!shareAll && selectedBranchIds.length === 0) {
      setError('Selecciona al menos una sucursal para el producto.');
      return;
    }

    setBusy(true);
    try {
      await createProduct({
        businessId: business.id,
        name: productName.trim(),
        description: productDescription.trim() || undefined,
        basePriceCents: priceCents,
        shareWithAllBranches: shareAll,
        branchIds: shareAll ? undefined : selectedBranchIds,
      });
      await reload();
      setProductName('');
      setProductDescription('');
      setPrice('');
      setSelectedBranchIds([]);
      setShowProductForm(false);
      setInfo(
        shareAll
          ? 'Producto creado y asignado a todas tus sucursales.'
          : 'Producto creado. Asígnalo a las sucursales que quieras.',
      );
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>Cargando tu negocio…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const categoryName = business?.categoryId
    ? categories.find((category) => category.id === business.categoryId)?.name
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>Mi negocio</Text>
          <View style={styles.topActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/vendor-orders')}
            >
              <Text style={styles.link}>Pedidos</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setBusy(true);
                reload()
                  .catch((caught) => setError(messageOf(caught)))
                  .finally(() => setBusy(false));
              }}
            >
              <Text style={styles.refresh}>Actualizar</Text>
            </Pressable>
          </View>
        </View>

        {info ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{info}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!business ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Crea tu empresa</Text>
            <Text style={styles.muted}>
              Es la marca que verán los compradores en el mapa. Podrás agregar varias sucursales.
            </Text>
            <TextField
              label="Nombre de la empresa"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Panadería La 70"
            />
            <TextField
              label="Descripción (opcional)"
              value={businessDescription}
              onChangeText={setBusinessDescription}
              placeholder="Pan artesanal y café de origen"
              multiline
            />
            <View style={styles.field}>
              <Text style={styles.label}>Moneda</Text>
              <View style={styles.chips}>
                {CURRENCIES.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={currency === item}
                    onPress={() => setCurrency(item)}
                  />
                ))}
              </View>
              <Text style={styles.helper}>
                Se usa en todos los precios y reportes. No se puede cambiar si ya hay pedidos.
              </Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Categoría</Text>
              <View style={styles.chips}>
                {categories.map((category) => (
                  <Chip
                    key={category.id}
                    label={`${category.icon ?? '•'} ${category.name}`}
                    selected={categoryId === category.id}
                    onPress={() => setCategoryId(category.id)}
                  />
                ))}
              </View>
            </View>
            <PrimaryButton label="Crear empresa" busy={busy} onPress={handleCreateBusiness} />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.businessName}>{business.name}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{business.currency}</Text>
                </View>
              </View>
              <Text style={styles.muted}>
                {categoryName ?? 'Sin categoría'} · buyersclub/{business.slug}
              </Text>
              <Text style={styles.muted}>
                {business.branches.length} sucursales · {products.length} productos
              </Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sucursales</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowBranchForm((current) => !current)}
              >
                <Text style={styles.link}>
                  {showBranchForm ? 'Cancelar' : '+ Agregar sucursal'}
                </Text>
              </Pressable>
            </View>

            {business.branches.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.muted}>
                  Aún no tienes sucursales. Agrega la primera para aparecer en el mapa.
                </Text>
              </View>
            ) : (
              business.branches.map((branch) => (
                <View key={branch.id} style={styles.card}>
                  <View style={styles.rowBetween}>
                    <View style={styles.branchText}>
                      <Text style={styles.itemTitle}>{branch.name}</Text>
                      <Text style={styles.muted}>
                        {branch.addressLine} · {branch.city}
                      </Text>
                    </View>
                    <Switch
                      value={branch.manualOpen}
                      onValueChange={(value) => handleToggleOpen(branch, value)}
                      trackColor={{ false: '#D1D5DB', true: colors.brand }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>
                      {branch.manualOpen ? 'Abierta' : 'Cerrada'}
                    </Text>
                    <Text style={styles.meta}>
                      Envío {money(branch.deliveryFeeCents, business.currency)}
                    </Text>
                    <Text style={styles.meta}>
                      Mínimo {money(branch.minOrderCents, business.currency)}
                    </Text>
                  </View>
                </View>
              ))
            )}

            {showBranchForm ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Nueva sucursal</Text>
                <TextField
                  label="Nombre"
                  value={branchName}
                  onChangeText={setBranchName}
                  placeholder="Sede Centro"
                />
                <TextField
                  label="Dirección"
                  value={addressLine}
                  onChangeText={setAddressLine}
                  placeholder="Calle 70 # 10-20"
                />
                <TextField
                  label="Ciudad"
                  value={city}
                  onChangeText={setCity}
                  placeholder="Bogotá"
                />
                <TextField
                  label="Teléfono (opcional)"
                  value={branchPhone}
                  onChangeText={setBranchPhone}
                  placeholder="+57 300 123 4567"
                  keyboardType="phone-pad"
                />
                <View style={styles.field}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={useMyLocation}
                    style={styles.locationButton}
                  >
                    <Text style={styles.locationText}>Usar mi ubicación actual</Text>
                  </Pressable>
                  <Text style={styles.helper}>
                    {coords
                      ? `Punto: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                      : 'Si no la marcas, ubicaremos la dirección automáticamente.'}
                  </Text>
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.label}>Domicilio</Text>
                  <Switch
                    value={deliveryEnabled}
                    onValueChange={setDeliveryEnabled}
                    trackColor={{ false: '#D1D5DB', true: colors.brand }}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Recogida en tienda</Text>
                  <Switch
                    value={pickupEnabled}
                    onValueChange={setPickupEnabled}
                    trackColor={{ false: '#D1D5DB', true: colors.brand }}
                  />
                </View>

                <View style={styles.grid}>
                  <View style={styles.gridItem}>
                    <TextField
                      label={`Costo de envío (${business.currency})`}
                      value={deliveryFee}
                      onChangeText={setDeliveryFee}
                      placeholder="3000"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.gridItem}>
                    <TextField
                      label={`Pedido mínimo (${business.currency})`}
                      value={minOrder}
                      onChangeText={setMinOrder}
                      placeholder="10000"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <TextField
                  label="Preparación (minutos)"
                  value={prepTime}
                  onChangeText={setPrepTime}
                  placeholder="20"
                  keyboardType="number-pad"
                />

                <View style={styles.grid}>
                  <View style={styles.gridItem}>
                    <TextField
                      label="Abre"
                      value={opensAt}
                      onChangeText={setOpensAt}
                      placeholder="08:00"
                    />
                  </View>
                  <View style={styles.gridItem}>
                    <TextField
                      label="Cierra"
                      value={closesAt}
                      onChangeText={setClosesAt}
                      placeholder="18:00"
                    />
                  </View>
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Abrir también los domingos</Text>
                  <Switch
                    value={openSunday}
                    onValueChange={setOpenSunday}
                    trackColor={{ false: '#D1D5DB', true: colors.brand }}
                  />
                </View>

                <PrimaryButton label="Crear sucursal" busy={busy} onPress={handleCreateBranch} />
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Catálogo</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowProductForm((current) => !current)}
              >
                <Text style={styles.link}>
                  {showProductForm ? 'Cancelar' : '+ Agregar producto'}
                </Text>
              </Pressable>
            </View>

            {products.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.muted}>
                  Tu catálogo está vacío. Crea un producto y decide si aplica a todas las
                  sucursales.
                </Text>
              </View>
            ) : (
              products.map((product) => (
                <View key={product.id} style={styles.productCard}>
                  <View style={styles.branchText}>
                    <Text style={styles.itemTitle}>{product.name}</Text>
                    <Text style={styles.muted}>
                      {product.branches.length} sucursales ·{' '}
                      {product.shareWithAllBranches ? 'compartido' : 'por sucursal'}
                    </Text>
                  </View>
                  <Text style={styles.price}>{money(product.basePriceCents, product.currency)}</Text>
                </View>
              ))
            )}

            {showProductForm ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Nuevo producto</Text>
                <TextField
                  label="Nombre"
                  value={productName}
                  onChangeText={setProductName}
                  placeholder="Pan campesino"
                />
                <TextField
                  label={`Precio (${business.currency})`}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="4500"
                  keyboardType="decimal-pad"
                />
                <TextField
                  label="Descripción (opcional)"
                  value={productDescription}
                  onChangeText={setProductDescription}
                  placeholder="Horneado del día"
                  multiline
                />
                <View style={styles.switchRow}>
                  <View style={styles.switchText}>
                    <Text style={styles.label}>Compartir en todas las sucursales</Text>
                    <Text style={styles.helper}>
                      Las sucursales nuevas lo reciben automáticamente.
                    </Text>
                  </View>
                  <Switch
                    value={shareAll}
                    onValueChange={setShareAll}
                    trackColor={{ false: '#D1D5DB', true: colors.brand }}
                  />
                </View>

                {!shareAll ? (
                  <View style={styles.field}>
                    <Text style={styles.label}>Sucursales donde se vende</Text>
                    <View style={styles.chips}>
                      {business.branches.map((branch) => (
                        <Chip
                          key={branch.id}
                          label={branch.name}
                          selected={selectedBranchIds.includes(branch.id)}
                          onPress={() =>
                            setSelectedBranchIds((current) =>
                              current.includes(branch.id)
                                ? current.filter((id) => id !== branch.id)
                                : [...current, branch.id],
                            )
                          }
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                <PrimaryButton label="Crear producto" busy={busy} onPress={handleCreateProduct} />
              </View>
            ) : null}

            <View style={styles.hintCard}>
              <Text style={styles.hintTitle}>Siguiente en Fase 2</Text>
              <Text style={styles.hintText}>
                Editar precios y stock por sucursal desde el catálogo, y la vista pública de tu
                tienda en el mapa (Fase 3).
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'decimal-pad' | 'number-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA8A4"
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({
  label,
  busy,
  onPress,
}: {
  label: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={[styles.button, busy && styles.buttonBusy]}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 22, color: colors.brand, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  refresh: { color: colors.brand, fontWeight: '600', fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  businessName: { fontSize: 22, fontWeight: '800', color: colors.text, flexShrink: 1 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  badge: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeText: { color: colors.brandDark, fontSize: 11, fontWeight: '800' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  link: { color: colors.brand, fontWeight: '700', fontSize: 13 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.lg,
  },
  branchText: { flexShrink: 1, gap: 2, flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  meta: { color: colors.muted, fontSize: 12 },
  productCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  price: { color: colors.text, fontWeight: '800', fontSize: 15 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
  },
  inputMultiline: { minHeight: 76, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: '#FFFFFF' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  switchText: { flex: 1, gap: 2 },
  locationButton: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  locationText: { color: colors.brand, fontWeight: '700', fontSize: 13 },
  grid: { flexDirection: 'row', gap: spacing.md },
  gridItem: { flex: 1 },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: spacing.xs,
  },
  buttonBusy: { opacity: 0.8 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  infoBox: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: spacing.md },
  infoText: { color: colors.brandDark, fontSize: 13, lineHeight: 19 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  hintCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  hintTitle: { color: colors.brandDark, fontSize: 14, fontWeight: '800' },
  hintText: { color: colors.brandDark, fontSize: 13, lineHeight: 19 },
});
