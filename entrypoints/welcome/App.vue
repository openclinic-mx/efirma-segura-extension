<script lang="ts" setup>
import SkyBg from "@/components/SkyBg.vue";
import {useDatabase} from "@/composables/database";
import {useSignatures} from "@/composables/signatures";

const {isInitialized} = useDatabase()

const {signatures} = useSignatures()

const openSidePanel = () => {
  browser.runtime.sendMessage({type: 'OPEN_TAB'})
}

const openAddSignature = () => {

  openSidePanel();

  setTimeout(() => {
    browser.runtime.sendMessage({type: 'VIEW_ADD_SIGNATURE'})
  }, 500)
}

const instructions = [
  {
    id: 1,
    icon: 'i-lucide-download',
    title: 'Paso 1',
    description: `Instalación`,
    info: '',
    links: [

    ],
    docs: [

    ]
  },
  {
    id: 1,
    icon: 'i-lucide-landmark',
    title: 'Paso 2',
    description: `Crear bóveda`,
    info: 'Abre tu bóveda y crea una contraseña maestra segura para protegerla.',

    links: [
      {
        onClick: () => openSidePanel(),
        icon: 'i-lucide-chevron-right',
        label: 'Crear bóveda',
      }
    ],
    docs: [
      {
        question: '¿Cómo es una contraseña maestra segura?',
        answer: 'Te recomendamos usar una frase de contraseña (passphrase): combina 3 o más palabras al azar que puedas recordar fácilmente, por ejemplo "gato lluvia mesa tren". Es más segura que una contraseña corta con símbolos y mucho más fácil de memorizar. Evita guardarla de forma digital en tus dispositivos.',
        defaultOpen: true,
      },
      {
        question: '¿Cómo accedo a mi bóveda?',
        answer: 'Puedes acceder a tu bóveda al dar clic en el ícono en tu lista de extensiones o en el botón de "Autocompletar" que se muestra en los formularios del SAT.',
      },
      {
        question: '¿Qué pasa si olvido mi contraseña maestra?',
        answer: 'Por diseño de seguridad, ni nosotros ni nadie puede recuperar tu contraseña maestra. Tu bóveda se cifra de forma que solo tú puedes descifrarla. Si la olvidas, deberás crear una nueva bóveda y volver a agregar tu e.firma.',
      },
    ]
  },
  {
    id: 2,
    icon: 'i-lucide-key',
    title: 'Paso 3',
    description: 'Guardar tu e.firma',
    info: 'Dentro de tu bóveda, da clic en "Agregar e.firma", selecciona tu archivo .cer y .key, escribe la contraseña de tu e.firma y guárdala.',
    links: [
      {
        onClick: () => openAddSignature(),
        icon: 'i-lucide-plus',
        label: 'Agregar e.firma',
      }
    ],
    docs: [
      {
        question: '¿Puedo guardar más de una e.firma?',
        answer: 'Sí, puedes agregar varias e.firmas en tu bóveda y elegir cuál utilizar al momento de iniciar sesión o realizar trámites.',
        defaultOpen: true,
      },
      {
        question: '¿Mi información está segura?',
        answer: 'Tu bóveda se cifra y almacena localmente en tu dispositivo con tu contraseña maestra. Ni nosotros ni terceros tienen acceso a tu e.firma.',
      },
      {
        question: '¿Qué pasa si desinstalo la extensión?',
        answer: 'Tu bóveda y su contenido se eliminarán. Asegúrate de siempre tener un respaldo offline de tus archivos .cer, .key y sus contraseñas.',
      },
    ]
  },
  {
    id: 3,
    icon: 'i-lucide-pointer',
    title: 'Paso 4',
    description: 'Utiliza tu e.firma con un clic',
    info: 'Visita cualquier portal del SAT o el IMSS y usa el nuevo botón de "Autocompletar" para mostrar tu bóveda y seleccionar la e.firma que deseas utilizar.',
    links: [
      {
        to: 'https://wwwmat.sat.gob.mx/personas/iniciar-sesion',
        icon: 'i-lucide-link',
        label: 'Ir al Buzon Tributario',
      }
    ],
    docs: [
      {
        question: '¿Dónde puedo utilizar e.firma Segura?',
        answer: 'Puedes iniciar sesión y realizar trámites en todos los portales en línea del SAT y el IMSS. Si encuentras un formulario que no muestre el botón de autocompletar, repórtalo a hola@openclinic.mx.',
        defaultOpen: true,
      },
      {
        question: '¿Es seguro utilizar mi e.firma de esta forma?',
        answer: 'Sí. Tu e.firma nunca sale de tu dispositivo. La extensión completa el formulario localmente, igual que si seleccionaras los archivos de forma manual.',
      }
    ]
  },
]

const active = computed(() => {
  if (signatures.value.length !== 0) {
    return 3;
  }

  if (isInitialized.value) {
    return 2;
  }

  return 1
})

const showAlert = ref(true)
</script>

<template>
  <UApp>
    <SkyBg/>
    <UDashboardGroup unit="rem">
      <UDashboardPanel class="h-full">


        <template #body>
          <UContainer class="h-full flex flex-col gap-8">
            <UAlert
                v-if="showAlert"
                variant="soft"
                class="shrink-0"
                icon="i-lucide-check"
                title="¡Listo! Ya tienes e.firma Segura instalada"
                description="Solo faltan 3 pasos rápidos para que puedas realizar trámites con tu e.firma en un solo clic."
                close
                @update:open="showAlert = false"
            />

            <div class="flex-1 flex items-center justify-center">
              <UStepper :items="instructions" orientation="horizontal" disabled :model-value="active" class="w-full">

                <template #content="{ item: step }">
                  <UPageCard
                      class="mt-4"
                      :icon="step.icon"
                      :title="`${step.title}. ${step.description}`"
                      :description="step.info"
                      spotlight
                  >

                    <template #footer>
                      <template v-for="link in step.links" :key="link.label">
                        <UButton v-bind="link"></UButton>
                      </template>
                    </template>
                  </UPageCard>
                  <UPageCard class="mt-4" variant="soft">
                    <template v-for="doc in step.docs" :key="doc.question">
                      <UCollapsible class="prose dark:prose-invert" :default-open="doc.defaultOpen">
                        <UButton color="neutral"
                                 variant="subtle"
                                 trailing-icon="i-lucide-chevron-down"
                                 :label="doc.question"
                        ></UButton>
                        <template #content>
                          <p v-text="doc.answer"></p>
                        </template>
                      </UCollapsible>
                    </template>
                  </UPageCard>
                </template>

              </UStepper>


            </div>
          </UContainer>
        </template>
      </UDashboardPanel>

    </UDashboardGroup>

  </UApp>
</template>
