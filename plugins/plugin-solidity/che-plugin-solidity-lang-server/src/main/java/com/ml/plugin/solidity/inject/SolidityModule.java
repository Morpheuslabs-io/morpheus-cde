package com.ml.plugin.solidity.inject;

import com.google.inject.AbstractModule;
import com.google.inject.multibindings.Multibinder;
import com.ml.plugin.solidity.languageserver.SolidityLanguageServerLauncher;

import org.eclipse.che.inject.DynaModule;
import org.eclipse.che.api.languageserver.launcher.LanguageServerLauncher;

@DynaModule
public class SolidityModule extends AbstractModule {
    @Override
    protected void configure() {
        Multibinder.newSetBinder(binder(), LanguageServerLauncher.class).addBinding().to(SolidityLanguageServerLauncher.class);
    }
}